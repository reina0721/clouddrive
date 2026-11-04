package httpdownload

import (
	"bytes"
	"context"
	"crypto/x509"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/logger"
)

// 来源仍使用公网名称；仅测试连接器把已验证的IP连接到本地夹具，不访问真实外部网络。
type fixtureResolver struct{ addresses []netip.Addr }

func (r fixtureResolver) LookupNetIP(context.Context, string, string) ([]netip.Addr, error) {
	return r.addresses, nil
}

type fixtureConnector struct {
	target    string
	mu        sync.Mutex
	addresses []string
}

func (c *fixtureConnector) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	c.mu.Lock()
	c.addresses = append(c.addresses, address)
	c.mu.Unlock()
	return (&net.Dialer{}).DialContext(ctx, network, c.target)
}
func (c *fixtureConnector) dials() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]string(nil), c.addresses...)
}

func sourceFixture(t *testing.T, handle http.HandlerFunc, addresses ...string) (*Client, *fixtureConnector) {
	t.Helper()
	server := httptest.NewServer(handle)
	t.Cleanup(server.Close)
	dial := &fixtureConnector{target: server.Listener.Addr().String()}
	if len(addresses) == 0 {
		addresses = []string{"8.8.8.8"}
	}
	dns := fixtureResolver{}
	for _, raw := range addresses {
		dns.addresses = append(dns.addresses, netip.MustParseAddr(raw))
	}
	client, err := newClient(service.DefaultDownloadPolicy().Source, time.Minute, logger.NewTestLogger(), dns, dial)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := client.Stop(context.Background()); err != nil {
			t.Error(err)
		}
	})
	return client, dial
}

func TestSourcePinsEveryDNSAnswerAndRejectsMixedPrivateResults(t *testing.T) {
	for _, addresses := range [][]string{{"8.8.8.8"}, {"8.8.8.8", "127.0.0.1"}} {
		t.Run(strings.Join(addresses, ","), func(t *testing.T) {
			client, dial := sourceFixture(t, func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Authorization") != "" || r.Header.Get("Cookie") != "" {
					t.Error("来源收到浏览器凭据")
				}
				if _, err := io.WriteString(w, "payload"); err != nil {
					t.Error(err)
				}
			}, addresses...)
			var received bytes.Buffer
			err := client.WithBody(t.Context(), service.DownloadSourceRequest{URI: "http://source.example/file?signature=private", MaxBytes: 20}, func(_ service.DownloadSourceHeaders, source io.Reader) error {
				_, err := io.Copy(&received, source)
				return err
			})
			if len(addresses) > 1 {
				if !errors.Is(err, model.ErrDownloadSourceBlocked) || len(dial.dials()) != 0 || received.Len() != 0 {
					t.Fatalf("混合DNS未在连接前拒绝: %T", err)
				}
			} else if err != nil || received.String() != "payload" || len(dial.dials()) != 1 || dial.dials()[0] != "8.8.8.8:80" {
				t.Fatalf("来源未钉住IP: %v %q", err, dial.dials())
			}
		})
	}
}

func TestSourceRejectsRedirectToPrivateNetworkWithoutLeakingSignedURI(t *testing.T) {
	client, dial := sourceFixture(t, func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://127.0.0.1/private?signature=never-log", http.StatusFound)
	})
	err := client.WithBody(t.Context(), service.DownloadSourceRequest{URI: "http://source.example/redirect?signature=never-log", MaxBytes: 20}, func(service.DownloadSourceHeaders, io.Reader) error { t.Error("不应进入来源回调"); return nil })
	if !errors.Is(err, model.ErrDownloadSourceBlocked) || len(dial.dials()) != 1 {
		t.Fatalf("重定向未拒绝: %T", err)
	}
	if strings.Contains(err.Error(), "never-log") {
		t.Fatal("公开错误泄露来源签名")
	}
	var cause *service.DownloadSourceError
	if !errors.As(err, &cause) || cause.Unwrap() == nil {
		t.Fatal("重定向失败丢失底层原因")
	}
}

func TestSourceResumeRequiresExactValidatorRangeAndEffectiveURI(t *testing.T) {
	for _, scenario := range []string{"valid", "ignored-range", "wrong-tag", "wrong-start"} {
		t.Run(scenario, func(t *testing.T) {
			client, _ := sourceFixture(t, func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Range") != "bytes=3-" || r.Header.Get("If-Range") != `"version-1"` {
					t.Error("缺少条件范围请求")
				}
				w.Header().Set("ETag", `"version-1"`)
				w.Header().Set("Content-Range", "bytes 3-5/6")
				if scenario == "wrong-tag" {
					w.Header().Set("ETag", `"version-2"`)
				}
				if scenario == "wrong-start" {
					w.Header().Set("Content-Range", "bytes 2-4/6")
				}
				if scenario == "ignored-range" {
					w.WriteHeader(http.StatusOK)
				} else {
					w.WriteHeader(http.StatusPartialContent)
				}
				if _, err := io.WriteString(w, "def"); err != nil {
					t.Error(err)
				}
			})
			uri := "http://source.example/file"
			var received bytes.Buffer
			total := int64(6)
			err := client.WithBody(t.Context(), service.DownloadSourceRequest{URI: uri, EffectiveURI: uri, OffsetBytes: 3, DeclaredBytes: &total, ValidatorKind: model.DownloadValidatorETag, ValidatorValue: `"version-1"`, MaxBytes: 20}, func(headers service.DownloadSourceHeaders, source io.Reader) error {
				if headers.DeclaredBytes == nil || *headers.DeclaredBytes != 6 {
					t.Error("丢失来源总长度")
				}
				_, err := io.Copy(&received, source)
				return err
			})
			if scenario == "valid" {
				if err != nil || received.String() != "def" {
					t.Fatalf("续传未成功: %v", err)
				}
			} else if !errors.Is(err, model.ErrDownloadSourceChanged) || received.Len() != 0 {
				t.Fatalf("不可靠响应进入追加回调: %T", err)
			}
		})
	}
}

func TestSourceBoundNeverPublishesProbeByteAndPreservesTruncatedFailure(t *testing.T) {
	for _, scenario := range []string{"too-large", "truncated"} {
		t.Run(scenario, func(t *testing.T) {
			client, _ := sourceFixture(t, func(w http.ResponseWriter, _ *http.Request) {
				if scenario == "truncated" {
					w.Header().Set("Content-Length", "8")
				} else {
					w.(http.Flusher).Flush()
				}
				if _, err := io.WriteString(w, "abcdef"); err != nil {
					t.Error(err)
				}
			})
			maximum := int64(3)
			if scenario == "truncated" {
				maximum = 20
			}
			var received bytes.Buffer
			err := client.WithBody(t.Context(), service.DownloadSourceRequest{URI: "http://source.example/file", MaxBytes: maximum}, func(_ service.DownloadSourceHeaders, source io.Reader) error {
				_, err := io.Copy(&received, source)
				return err
			})
			if scenario == "too-large" {
				if !errors.Is(err, model.ErrTooLarge) || received.String() != "abc" {
					t.Fatalf("探测字节被保存: %T %q", err, received.String())
				}
			} else {
				var failure *service.DownloadSourceError
				if !errors.Is(err, io.ErrUnexpectedEOF) || received.String() != "abcdef" || !errors.As(err, &failure) || failure.Failure != model.DownloadFailureIncomplete {
					t.Fatalf("截断错误或分类丢失: %T", err)
				}
			}
		})
	}
}

func TestIdleReadCancellationDoesNotOutliveRead(t *testing.T) {
	client, _ := sourceFixture(t, func(w http.ResponseWriter, r *http.Request) { w.(http.Flusher).Flush(); <-r.Context().Done() })
	client.policy.IdleTimeout = 20 * time.Millisecond
	err := client.WithBody(t.Context(), service.DownloadSourceRequest{URI: "http://source.example/idle", MaxBytes: 20}, func(_ service.DownloadSourceHeaders, source io.Reader) error {
		_, err := io.Copy(io.Discard, source)
		return err
	})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("空闲读取没有按预算取消: %T", err)
	}
}

func TestExplicitLoopbackScopeDoesNotPermitMetadataOrTransitionAddresses(t *testing.T) {
	policy := service.DefaultDownloadPolicy().Source
	policy.AllowedNetworks = []string{"::1/128", "127.0.0.1/32", "169.254.169.254/32"}
	client, err := newClient(policy, time.Minute, logger.NewTestLogger(), fixtureResolver{}, &fixtureConnector{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := client.Stop(context.Background()); err != nil {
			t.Error(err)
		}
	})
	for _, uri := range []string{"http://[::1]/fixture", "http://127.0.0.1/fixture"} {
		if _, _, err := client.Normalize(uri); err != nil {
			t.Fatalf("明确的夹具回环范围被误判为转换地址: %v", err)
		}
	}
	for _, uri := range []string{"http://169.254.169.254/metadata", "http://[64:ff9b::7f00:1]/translated"} {
		if _, _, err := client.Normalize(uri); !errors.Is(err, model.ErrDownloadSourceBlocked) {
			t.Fatal("额外范围放行了元数据或转换地址")
		}
	}
}

func TestHTTPSHTTP2IdleCancellationKeepsOtherStreamAlive(t *testing.T) {
	idleStarted := make(chan struct{})
	var wrongProtocol atomic.Bool
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ProtoMajor != 2 {
			wrongProtocol.Store(true)
		}
		switch r.URL.Path {
		case "/idle":
			w.(http.Flusher).Flush()
			close(idleStarted)
			<-r.Context().Done()
		case "/active":
			for range 5 {
				if _, err := io.WriteString(w, "x"); err != nil {
					return
				}
				w.(http.Flusher).Flush()
				select {
				case <-r.Context().Done():
					return
				case <-time.After(30 * time.Millisecond):
				}
			}
		default:
			if _, err := io.WriteString(w, "ok"); err != nil {
				t.Error(err)
			}
		}
	}))
	server.EnableHTTP2 = true
	server.StartTLS()
	t.Cleanup(server.Close)
	policy := service.DefaultDownloadPolicy().Source
	policy.AllowedNetworks, policy.IdleTimeout = []string{"127.0.0.1/32"}, 100*time.Millisecond
	dial := &fixtureConnector{target: server.Listener.Addr().String()}
	client, err := newClient(policy, time.Second, logger.NewTestLogger(), fixtureResolver{addresses: []netip.Addr{netip.MustParseAddr("127.0.0.1")}}, dial)
	if err != nil {
		t.Fatal(err)
	}
	// 只信任本夹具证书，保留TLS主机名、有效期和证书链校验。
	client.transport.TLSClientConfig.RootCAs = x509.NewCertPool()
	client.transport.TLSClientConfig.RootCAs.AddCert(server.Certificate())
	t.Cleanup(func() {
		if err := client.Stop(context.Background()); err != nil {
			t.Error(err)
		}
	})
	read := func(ctx context.Context, path string, destination io.Writer) error {
		return client.WithBody(ctx, service.DownloadSourceRequest{URI: server.URL + path, MaxBytes: 64}, func(_ service.DownloadSourceHeaders, source io.Reader) error {
			_, err := io.Copy(destination, source)
			return err
		})
	}
	if err := read(t.Context(), "/warmup", io.Discard); err != nil {
		t.Fatal(err)
	}
	lifetime, cancel := context.WithTimeout(t.Context(), 2*time.Second)
	done := make(chan struct{})
	var idleErr error
	go func() { defer close(done); idleErr = read(lifetime, "/idle", io.Discard) }()
	defer func() { cancel(); <-done }()
	select {
	case <-idleStarted:
	case <-lifetime.Done():
		t.Fatal("HTTP/2空闲流未启动")
	}
	var active bytes.Buffer
	if err := read(lifetime, "/active", &active); err != nil {
		t.Fatalf("一个流的空闲取消破坏了另一个流: %v", err)
	}
	select {
	case <-done:
	case <-lifetime.Done():
		t.Fatal("空闲流未按预算退出")
	}
	if !errors.Is(idleErr, context.DeadlineExceeded) || active.String() != "xxxxx" || wrongProtocol.Load() || len(dial.dials()) != 1 {
		t.Fatalf("没有在同一受校验TLS连接上隔离HTTP/2请求取消: %T", idleErr)
	}
}
