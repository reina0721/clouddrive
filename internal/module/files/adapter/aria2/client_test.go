package aria2

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/reina0721/clouddrive/internal/module/files/adapter/metainfo"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/logger"
)

func protocolClient(t *testing.T, handler http.HandlerFunc) *Client {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	client, err := New(service.TorrentNodeConfig{ID: "fixture", Name: "测试节点", Endpoint: server.URL, Secret: "fixture-secret", WorkspaceRoot: t.TempDir()}, metainfo.Decoder{}, logger.NewTestLogger())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := client.Stop(context.Background()); err != nil {
			t.Error(err)
		}
	})
	return client
}

func readRequest(t *testing.T, r *http.Request) rpcRequest {
	t.Helper()
	var request rpcRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		t.Error(err)
	}
	if len(request.Params) < 1 || request.Params[0] != "token:fixture-secret" || r.Header.Get("Authorization") != "" || r.URL.RawQuery != "" {
		t.Error("RPC凭据不在受控请求体内")
	}
	return request
}

func TestControlRefusesMismatchedDirectoryWithoutIssuingPause(t *testing.T) {
	var controls atomic.Int64
	client := protocolClient(t, func(w http.ResponseWriter, r *http.Request) {
		request := readRequest(t, r)
		if request.Method != "aria2.getOption" {
			controls.Add(1)
		}
		if err := json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": request.ID, "result": map[string]string{"dir": filepath.Join(t.TempDir(), "other")}}); err != nil {
			t.Error(err)
		}
	})
	job := service.TorrentJob{GID: "1234567890abcdef", Directory: filepath.Join(client.config.WorkspaceRoot, "1234567890abcdef"), Phase: service.TorrentJobPayload}
	if err := client.Pause(t.Context(), job); !errors.Is(err, service.ErrTorrentBinding) || controls.Load() != 0 {
		t.Fatalf("错误目录仍受到控制: %v", err)
	}
}

func TestRPCRejectsWrongIdentityOversizeAndRedactsNativeErrors(t *testing.T) {
	for _, scenario := range []string{"错误请求ID", "超大响应", "原始错误", "固定缺失", "认证失败"} {
		t.Run(scenario, func(t *testing.T) {
			client := protocolClient(t, func(w http.ResponseWriter, r *http.Request) {
				request := readRequest(t, r)
				if scenario == "超大响应" {
					if _, err := io.WriteString(w, strings.Repeat(" ", service.TorrentRPCResponseBytes+1)); err != nil {
						t.Error(err)
					}
					return
				}
				response := map[string]any{"jsonrpc": "2.0", "id": request.ID}
				switch scenario {
				case "错误请求ID":
					response["id"], response["result"] = request.ID+1, "OK"
				case "固定缺失":
					response["error"] = rpcFailure{Code: 1, Message: "GID 1234567890abcdef is not found"}
				case "认证失败":
					response["error"] = rpcFailure{Code: 1, Message: "Unauthorized fixture-secret"}
				default:
					response["error"] = rpcFailure{Code: 2, Message: "private-path fixture-secret"}
				}
				if scenario == "固定缺失" || scenario == "认证失败" {
					w.WriteHeader(http.StatusBadRequest)
				}
				if err := json.NewEncoder(w).Encode(response); err != nil {
					t.Error(err)
				}
			})
			var result string
			err := client.call(t.Context(), "aria2.getOption", &result, "1234567890abcdef")
			if err == nil || strings.Contains(err.Error(), "fixture-secret") || strings.Contains(err.Error(), "private-path") {
				t.Fatalf("错误未受控转换: %v", err)
			}
			if errors.Is(err, service.ErrTorrentJobMissing) != (scenario == "固定缺失") {
				t.Fatalf("错误地释放缺失job预算: %v", err)
			}
		})
	}
}

func TestSubmissionDistinguishesUnsentFromLostResponse(t *testing.T) {
	client := protocolClient(t, func(w http.ResponseWriter, r *http.Request) {
		readRequest(t, r)
		connection, _, err := w.(http.Hijacker).Hijack()
		if err != nil {
			t.Error(err)
			return
		}
		if err := connection.Close(); err != nil {
			t.Error(err)
		}
	})
	for _, canceled := range []bool{true, false} {
		ctx, cancel := context.WithCancel(t.Context())
		if canceled {
			cancel()
		}
		var result string
		err := client.call(ctx, "aria2.addUri", &result, []string{"magnet:?xt=urn:btih:" + strings.Repeat("a", 40)})
		cancel()
		var submission *service.TorrentSubmissionError
		if !errors.As(err, &submission) || submission.DefinitelyUnsent != canceled || submission.Acknowledged {
			t.Fatalf("提交不确定性被错误分类: %v", err)
		}
		if canceled && !errors.Is(err, context.Canceled) {
			t.Fatal("取消原因丢失")
		}
	}
}

func TestFileAccessRejectsEscapeAndValidatesLength(t *testing.T) {
	client := protocolClient(t, func(http.ResponseWriter, *http.Request) { t.Error("文件读取不应进行RPC") })
	job := service.TorrentJob{GID: "1234567890abcdef", Directory: filepath.Join(client.config.WorkspaceRoot, "1234567890abcdef"), Phase: service.TorrentJobPayload}
	if err := client.PrepareJob(t.Context(), job); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(job.Directory, "safe.bin"), []byte("bytes"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, relative := range []string{"../outside", "/outside", `a\b`} {
		if err := client.withFile(t.Context(), job, relative, 5, fileRequired, func(io.Reader, int64) error { t.Error("逃逸路径被打开"); return nil }); !errors.Is(err, service.ErrTorrentBinding) {
			t.Fatalf("未拒绝逃逸: %v", err)
		}
	}
	var actual []byte
	if err := client.withFile(t.Context(), job, "safe.bin", 5, fileRequired, func(reader io.Reader, size int64) error { var err error; actual, err = io.ReadAll(reader); return err }); err != nil || string(actual) != "bytes" {
		t.Fatalf("受控内容读取失败: %v", err)
	}
	if err := client.withFile(t.Context(), job, "safe.bin", 4, fileRequired, func(io.Reader, int64) error { t.Error("超过预算文件被打开"); return nil }); !errors.Is(err, service.ErrTorrentBinding) {
		t.Fatalf("大小预算未拒绝: %v", err)
	}
}
