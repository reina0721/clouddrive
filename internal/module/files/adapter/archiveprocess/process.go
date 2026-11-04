// Package archiveprocess 隔离压缩解析库与受限计算进程，不提供通用命令执行。
package archiveprocess

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/logger"
)

const WorkerArgument = "--internal-archive-worker-v1"
const maxHeaderBytes = 6*service.DefaultMaxBatchEntries*service.MaxArchivePathBytes + 65536

// 响应同时包含清单与内容的路径，各按JSON最坏转义预算，避免合法长路径被协议上限误拒。
const maxResponseBytes = (service.DefaultMaxArchiveBytes+2)/3*4 + 2*maxHeaderBytes
const maxDiagnosticBytes = 4096
const workerWaitDelay = 2 * time.Second

type Options struct {
	Executable      string
	PrefixArguments []string
	Policy          service.ArchivePolicy
	Logger          logger.Logger
}
type Processor struct{ options Options }

func New(options Options) (*Processor, error) {
	if options.Executable == "" || options.Logger == nil {
		return nil, fmt.Errorf("archive process dependencies incomplete")
	}
	if err := options.Policy.Validate(); err != nil {
		return nil, err
	}
	options.PrefixArguments = append([]string(nil), options.PrefixArguments...)
	return &Processor{options}, nil
}

type wireHeader struct {
	InputBytes int64                   `json:"inputBytes"`
	Password   string                  `json:"password"`
	Mode       service.ArchiveReadMode `json:"mode"`
	Paths      []string                `json:"paths"`
	MaxBytes   int64                   `json:"maxBytes"`
	MaxMembers int                     `json:"maxMembers"`
}
type wireResponse struct {
	Code   string                     `json:"code"`
	Result service.ArchiveParseResult `json:"result"`
}
type limitedBuffer struct {
	bytes.Buffer
	limit int64
}

func (b *limitedBuffer) Write(content []byte) (int, error) {
	if int64(len(content)) > b.limit-int64(b.Len()) {
		return 0, model.ErrTooLarge
	}
	return b.Buffer.Write(content)
}
func (p *Processor) Process(ctx context.Context, request service.ArchiveParseRequest) (result service.ArchiveParseResult, resultErr error) {
	if err := validateRequest(request); err != nil {
		return result, err
	}
	ctx, cancel := context.WithTimeout(ctx, p.options.Policy.Timeout)
	defer cancel()
	guard, err := newProcessGuard(p.options.Policy.WorkerMemoryBytes)
	if err != nil {
		return result, err
	}
	defer func() { resultErr = errors.Join(resultErr, guard.Close()) }()
	args := append(append([]string(nil), p.options.PrefixArguments...), WorkerArgument, strconv.FormatInt(p.options.Policy.WorkerMemoryBytes, 10))
	command := exec.CommandContext(ctx, p.options.Executable, args...)
	command.WaitDelay = workerWaitDelay
	output := &limitedBuffer{limit: maxResponseBytes}
	diagnostic := &limitedBuffer{limit: maxDiagnosticBytes}
	command.Stdout = output
	command.Stderr = diagnostic
	stdin, err := command.StdinPipe()
	if err != nil {
		return result, fmt.Errorf("archive input pipe: %w", err)
	}
	if err := command.Start(); err != nil {
		return result, errors.Join(service.ErrArchiveWorker, err, stdin.Close())
	}
	// stdin在附加资源限制前不写入，子进程尚不能接触不可信压缩内容。
	if err := guard.Attach(command.Process.Pid); err != nil {
		return result, errors.Join(service.ErrArchiveWorker, err, stdin.Close(), command.Process.Kill(), command.Wait())
	}
	header, err := json.Marshal(wireHeader{int64(len(request.Content)), request.Password, request.Mode, request.Paths, request.MaxBytes, request.MaxMembers})
	var writeErr error
	if err != nil {
		writeErr = err
	} else if len(header) > maxHeaderBytes {
		writeErr = model.ErrTooLarge
	} else {
		_, writeErr = stdin.Write(append(header, '\n'))
		if writeErr == nil {
			_, writeErr = io.Copy(stdin, bytes.NewReader(request.Content))
		}
	}
	closeErr := stdin.Close()
	waitErr := command.Wait()
	if ctx.Err() != nil {
		return result, errors.Join(ctx.Err(), writeErr, closeErr, waitErr)
	}
	if writeErr != nil || closeErr != nil || waitErr != nil {
		p.options.Logger.Debug("files.archive.worker", logger.String("phase", "failed"), logger.String("code", "worker_exit"))
		return result, errors.Join(service.ErrArchiveWorker, writeErr, closeErr, waitErr)
	}
	var response wireResponse
	decoder := json.NewDecoder(bytes.NewReader(output.Bytes()))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&response); err != nil {
		return result, errors.Join(service.ErrArchiveWorker, fmt.Errorf("archive worker response: %w", err))
	}
	if err := decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
		return result, errors.Join(service.ErrArchiveWorker, err)
	}
	switch response.Code {
	case "":
		return response.Result, nil
	case "invalid":
		return result, model.ErrInvalid
	case "large":
		return result, model.ErrTooLarge
	case "unsupported":
		return result, model.ErrUnsupported
	case "password":
		return result, service.ErrArchivePassword
	case "checksum":
		return result, errors.Join(service.ErrArchiveChecksum, zip.ErrChecksum)
	case "canceled":
		return result, context.Canceled
	default:
		return result, service.ErrArchiveWorker
	}
}
func readHeader(reader *bufio.Reader) ([]byte, error) {
	var result []byte
	for {
		fragment, err := reader.ReadSlice('\n')
		if len(fragment) > maxHeaderBytes-len(result) {
			return nil, model.ErrTooLarge
		}
		result = append(result, fragment...)
		if err == nil {
			return result, nil
		}
		if !errors.Is(err, bufio.ErrBufferFull) {
			return nil, err
		}
	}
}

// RunWorker 只从stdin读取计算请求，不加载配置、连接数据库或绑定端口。
func RunWorker(ctx context.Context, stdin io.Reader, stdout io.Writer, args []string) error {
	if len(args) != 1 {
		return model.ErrInvalid
	}
	memory, err := strconv.ParseInt(args[0], 10, 64)
	if err != nil || memory < service.MinArchiveWorkerMemoryBytes || memory > service.DefaultArchiveWorkerMemoryBytes {
		return model.ErrInvalid
	}
	if err := setWorkerMemory(memory); err != nil {
		return err
	}
	reader := bufio.NewReader(stdin)
	encoded, err := readHeader(reader)
	if err != nil {
		return err
	}
	var header wireHeader
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&header); err != nil {
		return model.ErrInvalid
	}
	if header.InputBytes < 0 || header.InputBytes > service.DefaultMaxArchiveBytes {
		return model.ErrTooLarge
	}
	content := make([]byte, int(header.InputBytes))
	if _, err := io.ReadFull(reader, content); err != nil {
		return err
	}
	if _, err := reader.ReadByte(); !errors.Is(err, io.EOF) {
		return model.ErrInvalid
	}
	request := service.ArchiveParseRequest{Content: content, Password: header.Password, Mode: header.Mode, Paths: header.Paths, MaxBytes: header.MaxBytes, MaxMembers: header.MaxMembers}
	result, parseErr := parse(ctx, request)
	response := wireResponse{Result: result}
	switch {
	case parseErr == nil:
	case errors.Is(parseErr, service.ErrArchivePassword):
		response.Code = "password"
	case errors.Is(parseErr, service.ErrArchiveChecksum) || errors.Is(parseErr, zip.ErrChecksum):
		response.Code = "checksum"
	case errors.Is(parseErr, model.ErrTooLarge):
		response.Code = "large"
	case errors.Is(parseErr, model.ErrUnsupported):
		response.Code = "unsupported"
	case errors.Is(parseErr, context.Canceled):
		response.Code = "canceled"
	default:
		response.Code = "invalid"
	}
	if parseErr != nil {
		response.Result = service.ArchiveParseResult{}
	}
	return json.NewEncoder(stdout).Encode(response)
}
