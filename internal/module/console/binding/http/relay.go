package httpbinding

import (
	"context"
	"crypto/tls"
	"errors"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

type RelayPolicy struct {
	AllowedOrigins   []string      `mapstructure:"allowedOrigins"`
	ProxyOrigins     []string      `mapstructure:"proxyOrigins"`
	MaxTimeout       time.Duration `mapstructure:"maxTimeout"`
	MaxResponseBytes int64         `mapstructure:"maxResponseBytes"`
}

func DefaultRelayPolicy() RelayPolicy {
	return RelayPolicy{MaxTimeout: 30 * time.Second, MaxResponseBytes: 2 << 20}
}

type ResolvedRequest struct {
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Headers   map[string]string `json:"headers"`
	Body      *string           `json:"body,omitempty"`
	TimeoutMS int               `json:"timeoutMs"`
	Disguise  *struct {
		TimeoutMS   int    `json:"timeoutMs"`
		UserAgent   string `json:"userAgent,omitempty"`
		Proxy       string `json:"proxy,omitempty"`
		Fingerprint string `json:"fingerprint,omitempty"`
	} `json:"disguise,omitempty"`
}
type ExecutedResponse struct {
	Status     int         `json:"status"`
	StatusText string      `json:"statusText"`
	DurationMS int64       `json:"durationMs"`
	SizeBytes  int         `json:"sizeBytes"`
	Headers    [][2]string `json:"headers"`
	Body       string      `json:"body"`
}
type ExecutionFailure struct {
	Kind    string `json:"kind"`
	Message string `json:"message"`
}
type ExecutionResult struct {
	OK       bool              `json:"ok"`
	Response *ExecutedResponse `json:"response,omitempty"`
	Failure  *ExecutionFailure `json:"failure,omitempty"`
}

func relayFailure(kind, message string) ExecutionResult {
	return ExecutionResult{Failure: &ExecutionFailure{Kind: kind, Message: message}}
}
func explicitlyAllowed(u *url.URL, origins []string) bool {
	for _, origin := range origins {
		if u.Scheme+"://"+u.Host == strings.TrimRight(origin, "/") {
			return true
		}
	}
	return false
}
func publicAddress(address netip.Addr) bool {
	address = address.Unmap()
	for _, value := range []string{"0.0.0.0/8", "192.0.0.0/24", "192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24", "240.0.0.0/4", "2001:db8::/32", "2001::/32", "2002::/16", "64:ff9b::/96", "64:ff9b:1::/48"} {
		if netip.MustParsePrefix(value).Contains(address) {
			return false
		}
	}
	return address.IsGlobalUnicast() && !address.IsPrivate() && !address.IsLoopback() && !address.IsLinkLocalUnicast() && !address.IsLinkLocalMulticast() && !address.IsUnspecified() && !netip.MustParsePrefix("100.64.0.0/10").Contains(address) && !netip.MustParsePrefix("198.18.0.0/15").Contains(address)
}

// ExecuteRelay 每次解析并固定连接 IP；重定向逐跳重验，禁止 DNS 重绑定绕过。
func ExecuteRelay(ctx context.Context, input ResolvedRequest, policy RelayPolicy) ExecutionResult {
	methods := map[string]bool{"GET": true, "POST": true, "PUT": true, "PATCH": true, "DELETE": true, "HEAD": true, "OPTIONS": true}
	if !methods[input.Method] {
		return relayFailure("unsupported", "Unsupported HTTP method")
	}
	target, err := url.Parse(input.URL)
	if err != nil || target.Hostname() == "" || target.User != nil || (target.Scheme != "http" && target.Scheme != "https") {
		return relayFailure("invalid-url", "An HTTP(S) URL without credentials is required")
	}
	timeout := time.Duration(input.TimeoutMS) * time.Millisecond
	if timeout <= 0 || timeout > policy.MaxTimeout {
		timeout = policy.MaxTimeout
	}
	if len(input.URL) > 8192 || len(input.Headers) > 100 {
		return relayFailure("unsupported", "Request metadata exceeds the server limit")
	}
	if input.Disguise != nil && (len(input.Disguise.UserAgent) > 1024 || strings.ContainsAny(input.Disguise.UserAgent, "\r\n")) {
		return relayFailure("unsupported", "Invalid User-Agent")
	}
	if input.Disguise != nil && input.Disguise.Fingerprint != "" {
		return relayFailure("unsupported", "TLS fingerprint emulation is not supported")
	}
	proxyURL := ""
	if input.Disguise != nil {
		proxyURL = input.Disguise.Proxy
	}
	if proxyURL != "" {
		proxy, err := url.Parse(proxyURL)
		if err != nil || proxy.Host == "" || proxy.User != nil || !explicitlyAllowed(proxy, policy.ProxyOrigins) {
			return relayFailure("unsupported", "Proxy is not in the server allowlist")
		}
		return relayFailure("unsupported", "Proxy transport is not enabled in this deployment")
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	permitted := func(ctx context.Context, u *url.URL) ([]netip.Addr, error) {
		if u.User != nil || (u.Scheme != "http" && u.Scheme != "https") {
			return nil, errors.New("invalid target")
		}
		ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", u.Hostname())
		if err != nil {
			return nil, err
		}
		if len(ips) == 0 {
			return nil, errors.New("empty DNS answer")
		}
		for _, ip := range ips {
			if !publicAddress(ip) && !explicitlyAllowed(u, policy.AllowedOrigins) {
				return nil, errors.New("target address is not allowed")
			}
		}
		return ips, nil
	}
	if _, err := permitted(ctx, target); err != nil {
		if ctx.Err() != nil {
			return relayContextFailure(ctx)
		}
		return relayFailure("invalid-url", "Target address is not allowed or cannot be resolved")
	}
	transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12}, MaxIdleConns: 1, DisableKeepAlives: true, ResponseHeaderTimeout: timeout}
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		scheme := "http"
		if port == "443" {
			scheme = "https"
		}
		u := &url.URL{Scheme: scheme, Host: net.JoinHostPort(host, port)}
		// 自定义端口上的 HTTPS 必须保持原始协议，以便精确匹配 allowlist。
		if host == target.Hostname() {
			u.Scheme = target.Scheme
			u.Host = target.Host
		}
		ips, err := permitted(ctx, u)
		if err != nil {
			return nil, err
		}
		dialer := net.Dialer{Timeout: timeout}
		var joined error
		for _, ip := range ips {
			connection, e := dialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), port))
			if e == nil {
				return connection, nil
			}
			joined = errors.Join(joined, e)
		}
		return nil, joined
	}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return errors.New("redirect limit exceeded")
		}
		_, err := permitted(req.Context(), req.URL)
		return err
	}}
	var body io.Reader
	if input.Body != nil {
		if len(*input.Body) > 1<<20 {
			return relayFailure("unsupported", "Request body exceeds the server limit")
		}
		body = strings.NewReader(*input.Body)
	}
	request, err := http.NewRequestWithContext(ctx, input.Method, input.URL, body)
	if err != nil {
		return relayFailure("invalid-url", "Invalid request")
	}
	blocked := map[string]bool{"host": true, "connection": true, "proxy-authorization": true, "proxy-connection": true, "transfer-encoding": true, "content-length": true, "upgrade": true, "te": true, "trailer": true}
	for key, value := range input.Headers {
		if blocked[strings.ToLower(key)] || strings.ContainsAny(key+value, "\r\n") {
			return relayFailure("unsupported", "Invalid or restricted request header")
		}
		request.Header.Set(key, value)
	}
	if input.Disguise != nil && input.Disguise.UserAgent != "" {
		request.Header.Set("User-Agent", input.Disguise.UserAgent)
	}
	start := time.Now()
	response, err := client.Do(request)
	if err != nil {
		if ctx.Err() != nil {
			kind := "aborted"
			if errors.Is(ctx.Err(), context.DeadlineExceeded) {
				kind = "timeout"
			}
			return relayFailure(kind, "Request did not complete")
		}
		return relayFailure("network", "Unable to complete the upstream request")
	}
	defer response.Body.Close()
	bytes, err := io.ReadAll(io.LimitReader(response.Body, policy.MaxResponseBytes+1))
	if err != nil {
		if ctx.Err() != nil {
			return relayContextFailure(ctx)
		}
		return relayFailure("network", "Unable to read upstream response")
	}
	if int64(len(bytes)) > policy.MaxResponseBytes {
		return relayFailure("unsupported", "Response exceeds the server limit")
	}
	headers := [][2]string{}
	for key, values := range response.Header {
		for _, value := range values {
			headers = append(headers, [2]string{key, value})
		}
	}
	return ExecutionResult{OK: true, Response: &ExecutedResponse{Status: response.StatusCode, StatusText: http.StatusText(response.StatusCode), DurationMS: time.Since(start).Milliseconds(), SizeBytes: len(bytes), Headers: headers, Body: string(bytes)}}
}

func relayContextFailure(ctx context.Context) ExecutionResult {
	kind := "aborted"
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		kind = "timeout"
	}
	return relayFailure(kind, "Request did not complete")
}
