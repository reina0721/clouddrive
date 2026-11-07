// Package aria2 封装管理员配置的下载节点，不允许用户指定RPC端点或方法。
package aria2

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/logger"
)

const (
	rpcVersion      = "2.0"
	rpcContentType  = "application/json"
	rpcTokenPrefix  = "token:"
	rpcMaxHeader    = 16 << 10
	rpcConnections  = 2
	rpcGIDBytes     = 8
	rpcIdleTimeout  = 15 * time.Second
	participantName = "files.bittorrent.node"
)

type Client struct {
	config    service.TorrentNodeConfig
	decoder   service.TorrentMetadataDecoder
	logger    logger.Logger
	transport *http.Transport
	http      *http.Client
	sequence  atomic.Uint64
	closed    atomic.Bool
}

var _ service.TorrentEngine = (*Client)(nil)

// New 仅创建内存实例；目录准入与节点就绪I/O由composition的准备阶段负责。
func New(config service.TorrentNodeConfig, decoder service.TorrentMetadataDecoder, logging logger.Logger) (*Client, error) {
	if err := config.Validate(); err != nil {
		return nil, err
	}
	if decoder == nil || logging == nil {
		return nil, service.ErrTorrentNode
	}
	config.WorkspaceRoot = filepath.Clean(config.WorkspaceRoot)
	transport := &http.Transport{
		Proxy: nil, DialContext: (&net.Dialer{Timeout: service.TorrentRPCRequestTime}).DialContext,
		TLSClientConfig:     &tls.Config{MinVersion: tls.VersionTLS12},
		TLSHandshakeTimeout: service.TorrentRPCRequestTime, ResponseHeaderTimeout: service.TorrentRPCRequestTime,
		MaxResponseHeaderBytes: rpcMaxHeader, MaxIdleConns: rpcConnections, MaxIdleConnsPerHost: rpcConnections,
		MaxConnsPerHost: rpcConnections, IdleConnTimeout: rpcIdleTimeout, DisableCompression: true,
	}
	client := &Client{config: config, decoder: decoder, logger: logging, transport: transport}
	client.http = &http.Client{Transport: transport, Timeout: service.TorrentRPCRequestTime, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	return client, nil
}

func (c *Client) Name() string { return participantName + "." + c.config.ID }

func (c *Client) Start(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if c.closed.Load() {
		return service.ErrTorrentNode
	}
	c.logger.Debug("files.bittorrent.client.started", logger.String("owner", "files.bittorrent"), logger.String("phase", "start"))
	return nil
}

func (c *Client) Stop(ctx context.Context) error {
	c.closed.Store(true)
	c.transport.CloseIdleConnections()
	c.logger.Debug("files.bittorrent.node.stopped", logger.String("owner", "files.bittorrent"), logger.String("phase", "stopped"))
	return ctx.Err()
}

// rpcError 丢弃下载器可能包含路径、URI和秘密的message，只保留数值代码。
type rpcError struct{ Code int }

func nodeCause(cause error) error {
	if cause == nil {
		return nil
	}
	return &service.TorrentError{Kind: service.ErrTorrentNode, Cause: cause}
}

func (e *rpcError) Error() string { return fmt.Sprintf("torrent RPC code %d", e.Code) }

type rpcRequest struct {
	Version string `json:"jsonrpc"`
	ID      uint64 `json:"id"`
	Method  string `json:"method"`
	Params  []any  `json:"params"`
}

type rpcResponse struct {
	Version string          `json:"jsonrpc"`
	ID      uint64          `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *rpcFailure     `json:"error"`
}

// rpcFailure的message只在边界内识别固定版本的精确缺失回执，不进入错误链或日志。
type rpcFailure struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func missingJobResponse(method string, arguments []any, failure *rpcFailure) bool {
	if failure.Code != 1 || len(arguments) == 0 {
		return false
	}
	gid, ok := arguments[0].(string)
	if !ok {
		return false
	}
	switch method {
	case "aria2.getOption", "aria2.tellStatus", "aria2.removeDownloadResult":
		return failure.Message == "GID "+gid+" is not found" || method == "aria2.getOption" && failure.Message == "Cannot get option for GID#"+gid || method == "aria2.tellStatus" && failure.Message == "No such download for GID#"+gid
	default:
		return false
	}
}

// call 的动态参数仅承担JSON-RPC的异构编码，业务契约不使用任意map/反射。
func (c *Client) call(ctx context.Context, method string, result any, arguments ...any) (returned error) {
	var wroteHeaders atomic.Bool
	if method == "aria2.addUri" || method == "aria2.addTorrent" {
		defer func() {
			if returned != nil {
				returned = &service.TorrentSubmissionError{DefinitelyUnsent: !wroteHeaders.Load(), Cause: returned}
			}
		}()
		ctx = httptrace.WithClientTrace(ctx, &httptrace.ClientTrace{WroteHeaders: func() { wroteHeaders.Store(true) }})
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if c.closed.Load() {
		return service.ErrTorrentNode
	}
	id := c.sequence.Add(1)
	params := append([]any{rpcTokenPrefix + c.config.Secret}, arguments...)
	body, err := json.Marshal(rpcRequest{Version: rpcVersion, ID: id, Method: method, Params: params})
	if err != nil {
		return &service.TorrentError{Kind: service.ErrTorrentProtocol, Cause: err}
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.config.Endpoint, bytes.NewReader(body))
	if err != nil {
		return &service.TorrentError{Kind: service.ErrTorrentNode, Cause: err}
	}
	request.Header.Set("Content-Type", rpcContentType)
	response, err := c.http.Do(request)
	if err != nil {
		// url.Error包含RPC地址；只保留底层链，不能向上导出完整端点。
		var endpointError *url.Error
		if errors.As(err, &endpointError) {
			err = endpointError.Err
		}
		return &service.TorrentError{Kind: service.ErrTorrentNode, Cause: err}
	}
	defer func() { returned = errors.Join(returned, nodeCause(response.Body.Close())) }()
	switch response.StatusCode {
	case http.StatusOK, http.StatusBadRequest, http.StatusNotFound, http.StatusInternalServerError:
		// aria2把JSON-RPC错误放在非200响应体；仍须验证完整信封才可识别固定缺失回执。
	default:
		return service.ErrTorrentNode
	}
	raw, err := io.ReadAll(io.LimitReader(response.Body, service.TorrentRPCResponseBytes+1))
	if err != nil {
		return &service.TorrentError{Kind: service.ErrTorrentNode, Cause: err}
	}
	if len(raw) > service.TorrentRPCResponseBytes {
		return service.ErrTorrentProtocol
	}
	var envelope rpcResponse
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return &service.TorrentError{Kind: service.ErrTorrentProtocol, Cause: err}
	}
	if envelope.ID != id || envelope.Version != rpcVersion || (envelope.Error != nil) == (len(envelope.Result) != 0) {
		return service.ErrTorrentProtocol
	}
	if envelope.Error != nil {
		kind := service.ErrTorrentNode
		if response.StatusCode == http.StatusBadRequest && missingJobResponse(method, arguments, envelope.Error) {
			kind = service.ErrTorrentJobMissing
		}
		return &service.TorrentError{Kind: kind, Cause: &rpcError{Code: envelope.Error.Code}}
	}
	if response.StatusCode != http.StatusOK {
		return service.ErrTorrentProtocol
	}
	if err := json.Unmarshal(envelope.Result, result); err != nil {
		return &service.TorrentError{Kind: service.ErrTorrentProtocol, Cause: err}
	}
	return nil
}

func (c *Client) validateJob(job service.TorrentJob) error {
	if job.Phase != service.TorrentJobMetadata && job.Phase != service.TorrentJobPayload {
		return service.ErrTorrentBinding
	}
	decoded, err := hex.DecodeString(job.GID)
	if err != nil || len(decoded) != rpcGIDBytes || job.GID != strings.ToLower(job.GID) || job.GID == strings.Repeat("0", rpcGIDBytes*2) {
		return service.ErrTorrentBinding
	}
	if filepath.Clean(job.Directory) != filepath.Join(c.config.WorkspaceRoot, job.GID) {
		return service.ErrTorrentBinding
	}
	return nil
}

type jobOptions struct {
	GID                string `json:"gid"`
	Directory          string `json:"dir"`
	Pause              string `json:"pause"`
	MetadataOnly       string `json:"bt-metadata-only"`
	SaveMetadata       string `json:"bt-save-metadata"`
	SelectFile         string `json:"select-file,omitempty"`
	SeedTime           string `json:"seed-time"`
	CheckIntegrity     string `json:"check-integrity"`
	AllowOverwrite     string `json:"allow-overwrite"`
	AutoFileRename     string `json:"auto-file-renaming"`
	Continue           string `json:"continue"`
	FileAllocation     string `json:"file-allocation"`
	SaveUploadMetadata string `json:"rpc-save-upload-metadata"`
}

func options(job service.TorrentJob, metadata bool) jobOptions {
	return jobOptions{GID: job.GID, Directory: job.Directory, Pause: "true", MetadataOnly: strconv.FormatBool(metadata), SaveMetadata: strconv.FormatBool(metadata), SeedTime: "0", CheckIntegrity: "true", AllowOverwrite: "false", AutoFileRename: "false", Continue: "true", FileAllocation: "none", SaveUploadMetadata: "true"}
}

func (c *Client) AddMetadata(ctx context.Context, job service.TorrentJob, magnet string) (returned error) {
	calledRPC := false
	defer func() {
		if returned != nil {
			var submission *service.TorrentSubmissionError
			if !errors.As(returned, &submission) {
				returned = &service.TorrentSubmissionError{DefinitelyUnsent: !calledRPC, Cause: returned}
			}
		}
	}()
	if job.Phase != service.TorrentJobMetadata {
		return service.ErrTorrentBinding
	}
	if err := c.validateJob(job); err != nil {
		return err
	}
	uri, _, err := c.decoder.NormalizeMagnet(magnet)
	if err != nil {
		return err
	}
	var gid string
	calledRPC = true
	if err := c.call(ctx, "aria2.addUri", &gid, []string{uri}, options(job, true)); err != nil {
		if gid == job.GID {
			return &service.TorrentSubmissionError{Acknowledged: true, Cause: err}
		}
		return err
	}
	if gid != job.GID {
		return service.ErrTorrentBinding
	}
	return nil
}

func (c *Client) AddPayload(ctx context.Context, job service.TorrentJob, raw []byte, selected []int) (returned error) {
	calledRPC := false
	defer func() {
		if returned != nil {
			var submission *service.TorrentSubmissionError
			if !errors.As(returned, &submission) {
				returned = &service.TorrentSubmissionError{DefinitelyUnsent: !calledRPC, Cause: returned}
			}
		}
	}()
	if job.Phase != service.TorrentJobPayload {
		return service.ErrTorrentBinding
	}
	if err := c.validateJob(job); err != nil {
		return err
	}
	metadata, err := c.decoder.Decode(raw)
	if err != nil {
		return err
	}
	if len(selected) == 0 || len(selected) > len(metadata.Files) {
		return service.ErrTorrentMetadata
	}
	indexes := append([]int(nil), selected...)
	sort.Ints(indexes)
	encoded := make([]string, len(indexes))
	for position, index := range indexes {
		if index < 1 || index > len(metadata.Files) || (position > 0 && index == indexes[position-1]) {
			return service.ErrTorrentMetadata
		}
		encoded[position] = strconv.Itoa(index)
	}
	jobOptions := options(job, false)
	jobOptions.SelectFile = strings.Join(encoded, ",")
	var gid string
	calledRPC = true
	if err := c.call(ctx, "aria2.addTorrent", &gid, base64.StdEncoding.EncodeToString(raw), []string{}, jobOptions); err != nil {
		if gid == job.GID {
			return &service.TorrentSubmissionError{Acknowledged: true, Cause: err}
		}
		return err
	}
	if gid != job.GID {
		return service.ErrTorrentBinding
	}
	return nil
}

func (c *Client) bound(ctx context.Context, job service.TorrentJob) error {
	if err := c.validateJob(job); err != nil {
		return err
	}
	var actual struct {
		Directory string `json:"dir"`
	}
	if err := c.call(ctx, "aria2.getOption", &actual, job.GID); err != nil {
		return err
	}
	if filepath.Clean(actual.Directory) != filepath.Clean(job.Directory) {
		return service.ErrTorrentBinding
	}
	return nil
}

func (c *Client) control(ctx context.Context, job service.TorrentJob, method string) error {
	if err := c.bound(ctx, job); err != nil {
		return err
	}
	var gid string
	if err := c.call(ctx, method, &gid, job.GID); err != nil {
		return err
	}
	if gid != job.GID {
		return service.ErrTorrentBinding
	}
	return nil
}

func (c *Client) Pause(ctx context.Context, job service.TorrentJob) error {
	return c.control(ctx, job, "aria2.pause")
}
func (c *Client) Resume(ctx context.Context, job service.TorrentJob) error {
	return c.control(ctx, job, "aria2.unpause")
}

// Remove 只控制绑定的job；终态结果和活动任务使用下载器各自的精确入口。
// 活动任务移除是异步请求，调用方必须确认停止后才释放目录及额度。
func (c *Client) Remove(ctx context.Context, job service.TorrentJob) error {
	progress, err := c.Progress(ctx, job)
	if err != nil {
		return err
	}
	switch progress.State {
	case service.TorrentNodeComplete, service.TorrentNodeError, service.TorrentNodeRemoved:
		var result string
		if err := c.call(ctx, "aria2.removeDownloadResult", &result, job.GID); err != nil {
			return err
		}
		if result != "OK" {
			return service.ErrTorrentProtocol
		}
		return nil
	default:
		return c.control(ctx, job, "aria2.remove")
	}
}
