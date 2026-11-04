package archiveprocess

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/logger"
)

// TestArchiveWorkerProcess 只在测试明确启动的子进程中运行真实协议。
func TestArchiveWorkerProcess(t *testing.T) {
	marker := slices.Index(os.Args, WorkerArgument)
	if marker < 0 {
		return
	}
	if err := RunWorker(context.Background(), os.Stdin, os.Stdout, os.Args[marker+1:]); err != nil {
		os.Exit(2)
	}
	os.Exit(0)
}
func TestArchiveBlockedProcess(t *testing.T) {
	if slices.Contains(os.Args, WorkerArgument) {
		time.Sleep(time.Hour)
		os.Exit(0)
	}
}
func TestArchiveMemoryProcess(t *testing.T) {
	marker := slices.Index(os.Args, WorkerArgument)
	if marker < 0 {
		return
	}
	if err := setWorkerMemory(service.MinArchiveWorkerMemoryBytes); err != nil {
		os.Exit(2)
	}
	// 父进程写入首字节前已经附加Job；分配超过限制不应影响父服务。
	one := make([]byte, 1)
	if _, err := io.ReadFull(os.Stdin, one); err != nil {
		os.Exit(2)
	}
	allocation := make([]byte, 1<<30)
	for i := 0; i < len(allocation); i += 4096 {
		allocation[i] = 1
	}
	_, _ = os.Stdout.Write(allocation[:1])
	os.Exit(0)
}
func processForTest(t *testing.T, name string, timeout time.Duration) *Processor {
	t.Helper()
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	policy := service.DefaultArchivePolicy()
	policy.Timeout = timeout
	processor, err := New(Options{Executable: executable, PrefixArguments: []string{"-test.run=^" + name + "$", "--"}, Policy: policy, Logger: logger.Noop()})
	if err != nil {
		t.Fatal(err)
	}
	return processor
}
func zipFixture(t *testing.T, name string, content []byte, method uint16, mode fs.FileMode) []byte {
	t.Helper()
	var output bytes.Buffer
	writer := zip.NewWriter(&output)
	header := &zip.FileHeader{Name: name, Method: method}
	header.SetMode(mode)
	member, err := writer.CreateHeader(header)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := member.Write(content); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return output.Bytes()
}
func parseRequest(content []byte) service.ArchiveParseRequest {
	return service.ArchiveParseRequest{Content: content, Mode: service.ArchiveReadAll, MaxBytes: service.DefaultMaxArchiveBytes, MaxMembers: service.DefaultMaxBatchEntries}
}
func TestProcessZIPRealBytesImplicitDirectoriesAndCRC(t *testing.T) {
	processor := processForTest(t, "TestArchiveWorkerProcess", 5*time.Second)
	original := []byte("archive-crc-content")
	request := parseRequest(zipFixture(t, "docs/a.txt", original, zip.Store, 0600))
	result, err := processor.Process(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if result.Format != "zip" || len(result.Members) != 2 || len(result.Payloads) != 1 || !bytes.Equal(result.Payloads[0].Content, original) {
		t.Fatalf("ZIP字节/隐式目录错误: %#v", result)
	}
	broken := append([]byte(nil), request.Content...)
	offset := bytes.Index(broken, original)
	if offset < 0 {
		t.Fatal("缺少CRC测试字节")
	}
	broken[offset] ^= 1
	request.Content = broken
	if _, err := processor.Process(context.Background(), request); !errors.Is(err, service.ErrArchiveChecksum) || !errors.Is(err, zip.ErrChecksum) {
		t.Fatalf("损坏内容必须保留CRC错误类别: %v", err)
	}
}
func TestProcessRejectsUnsafePathsLinksAndExpandedBudget(t *testing.T) {
	processor := processForTest(t, "TestArchiveWorkerProcess", 5*time.Second)
	for _, name := range []string{"../escape.txt", "/absolute.txt", "C:/drive.txt", "folder\\file.txt", "a/../../escape"} {
		t.Run(name, func(t *testing.T) {
			_, err := processor.Process(context.Background(), parseRequest(zipFixture(t, name, []byte("a"), zip.Store, 0600)))
			if !errors.Is(err, model.ErrInvalid) {
				t.Fatalf("非法路径被接受: %v", err)
			}
		})
	}
	_, err := processor.Process(context.Background(), parseRequest(zipFixture(t, "link", []byte("target"), zip.Store, fs.ModeSymlink|0600)))
	if !errors.Is(err, model.ErrUnsupported) {
		t.Fatalf("符号链接未拒绝: %v", err)
	}
	request := parseRequest(zipFixture(t, "expanded.txt", bytes.Repeat([]byte("x"), 32768), zip.Deflate, 0600))
	request.MaxBytes = 1024
	if _, err := processor.Process(context.Background(), request); !errors.Is(err, model.ErrTooLarge) {
		t.Fatalf("展开预算未生效: %v", err)
	}
}
func TestProcess7ZPlainEncryptedHeaderAndContent(t *testing.T) {
	processor := processForTest(t, "TestArchiveWorkerProcess", 5*time.Second)
	for _, name := range []string{"t0.7z", "t1.7z", "t2.7z", "t3.7z", "t4.7z", "t5.7z"} {
		t.Run(name, func(t *testing.T) {
			content, err := os.ReadFile(filepath.Join("testdata", "sevenzip", name))
			if err != nil {
				t.Fatal(err)
			}
			request := parseRequest(content)
			encrypted := name != "t0.7z" && name != "t1.7z"
			if encrypted {
				request.Password = "password"
			}
			result, err := processor.Process(context.Background(), request)
			if err != nil {
				t.Fatal(err)
			}
			if result.Format != "7z" || len(result.Payloads) == 0 {
				t.Fatalf("缺少真实7Z成员: %#v", result)
			}
			var text strings.Builder
			for _, payload := range result.Payloads {
				text.Write(payload.Content)
			}
			if text.Len() == 0 {
				t.Fatal("7Z内容为空")
			}
			if encrypted {
				request.Password = "notpassword"
				if _, err := processor.Process(context.Background(), request); !errors.Is(err, service.ErrArchivePassword) && !errors.Is(err, service.ErrArchiveChecksum) {
					t.Fatalf("错误密码未被明确拒绝: %v", err)
				}
			}
		})
	}
}
func TestProcessDeadlineMemoryAndParentSurvival(t *testing.T) {
	request := parseRequest(zipFixture(t, "a.txt", []byte("a"), zip.Store, 0600))
	blocked := processForTest(t, "TestArchiveBlockedProcess", 200*time.Millisecond)
	started := time.Now()
	if _, err := blocked.Process(context.Background(), request); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("缺少超时错误链: %v", err)
	}
	if time.Since(started) > 4*time.Second {
		t.Fatal("子进程未及时退出")
	}
	limited := processForTest(t, "TestArchiveMemoryProcess", 5*time.Second)
	if _, err := limited.Process(context.Background(), request); !errors.Is(err, service.ErrArchiveWorker) {
		t.Fatalf("超额内存未失败关闭: %v", err)
	}
	normal := processForTest(t, "TestArchiveWorkerProcess", 5*time.Second)
	if _, err := normal.Process(context.Background(), request); err != nil {
		t.Fatalf("子进程失败影响父进程后续请求: %v", err)
	}
}
