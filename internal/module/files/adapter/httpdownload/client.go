// Package httpdownload 隔离离线文件来源的公网连接、HTTP续传和响应资源。
package httpdownload

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/logger"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
	"unicode"
	"unicode/utf8"
)

const (
	participantName          = "files.offline.source"
	sourceUserAgent          = "clouddrive-offline/1"
	sourceMaxIdleConnections = 16
	sourceMaxHostConnections = 2
	sourceMaxHostnameBytes   = 253
	transitionNetworks       = `::/96 64:ff9b::/96 64:ff9b:1::/48 2002::/16`
	// IANA特殊用途空间采用保守的源访问策略，转换地址不得替代实际目标校验。
	specialNetworks   = `0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.0.2.0/24 192.88.99.0/24 192.168.0.0/16 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 224.0.0.0/4 240.0.0.0/4 100::/64 2001::/23 2001:db8::/32 3fff::/20 5f00::/16 fc00::/7 fe80::/10 fec0::/10 ff00::/8`
	metadataAddresses = `169.254.169.254 169.254.170.2 168.63.129.16 100.100.100.200 fd00:ec2::254`
)

type resolver interface {
	LookupNetIP(context.Context, string, string) ([]netip.Addr, error)
}
type connector interface {
	DialContext(context.Context, string, string) (net.Conn, error)
}

// Client 由composition启动/关闭；业务不能取得Transport或切换网络信任策略。
type Client struct {
	transitions []netip.Prefix
	policy      service.DownloadSourcePolicy
	resolver    resolver
	connector   connector
	client      *http.Client
	transport   *http.Transport
	blocked     []netip.Prefix
	allowed     []netip.Prefix
	metadata    []netip.Addr
	logger      logger.Logger
	closed      atomic.Bool
}

func New(policy service.DownloadSourcePolicy, attemptTimeout time.Duration, logging logger.Logger) (*Client, error) {
	return newClient(policy, attemptTimeout, logging, &net.Resolver{}, &net.Dialer{Timeout: policy.ConnectTimeout, KeepAlive: policy.IdleTimeout})
}
func newClient(policy service.DownloadSourcePolicy, attemptTimeout time.Duration, logging logger.Logger, dns resolver, dial connector) (*Client, error) {
	if logging == nil || dns == nil || dial == nil || attemptTimeout <= 0 || attemptTimeout > service.DefaultDownloadAttemptTimeout {
		return nil, fmt.Errorf("offline source dependencies missing")
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	c := &Client{policy: policy, resolver: dns, connector: dial, logger: logging}
	c.policy.AllowedNetworks = append([]string(nil), policy.AllowedNetworks...)
	for _, raw := range strings.Fields(specialNetworks) {
		prefix, err := netip.ParsePrefix(raw)
		if err != nil {
			return nil, fmt.Errorf("parse offline network policy: %w", err)
		}
		c.blocked = append(c.blocked, prefix)
	}
	for _, raw := range policy.AllowedNetworks {
		prefix, err := netip.ParsePrefix(raw)
		if err != nil {
			return nil, fmt.Errorf("parse offline additional network: %w", err)
		}
		c.allowed = append(c.allowed, prefix)
	}
	for _, raw := range strings.Fields(transitionNetworks) {
		prefix, err := netip.ParsePrefix(raw)
		if err != nil {
			return nil, fmt.Errorf("parse offline transition policy: %w", err)
		}
		c.transitions = append(c.transitions, prefix)
	}
	for _, raw := range strings.Fields(metadataAddresses) {
		address, err := netip.ParseAddr(raw)
		if err != nil {
			return nil, fmt.Errorf("parse offline metadata policy: %w", err)
		}
		c.metadata = append(c.metadata, address)
	}
	c.transport = &http.Transport{Proxy: nil, DialContext: c.dial, ForceAttemptHTTP2: true, TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12}, TLSHandshakeTimeout: policy.ConnectTimeout, ResponseHeaderTimeout: policy.ConnectTimeout, MaxResponseHeaderBytes: policy.HeaderBytes, DisableCompression: true, IdleConnTimeout: policy.IdleTimeout, MaxIdleConns: sourceMaxIdleConnections, MaxIdleConnsPerHost: sourceMaxHostConnections, MaxConnsPerHost: sourceMaxHostConnections}
	c.client = &http.Client{Transport: c.transport, Timeout: attemptTimeout, CheckRedirect: func(request *http.Request, via []*http.Request) error {
		if len(via) > policy.Redirects {
			return sourceFailure(model.DownloadFailureBlocked, nil)
		}
		if _, _, err := c.Normalize(request.URL.String()); err != nil {
			return err
		}
		if len(via) > 0 && via[len(via)-1].URL.Scheme == "https" && request.URL.Scheme != "https" {
			return sourceFailure(model.DownloadFailureBlocked, nil)
		}
		request.Header.Del("Referer")
		request.Header.Del("Cookie")
		request.Header.Del("Authorization")
		return nil
	}}
	return c, nil
}
func (*Client) Name() string { return participantName }
func (c *Client) Start(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if c.closed.Load() {
		return model.ErrDownloadUnavailable
	}
	c.logger.Debug("files.offline.source.ready", logger.String("owner", "files.offline"), logger.String("phase", "ready"))
	return nil
}
func (c *Client) Stop(ctx context.Context) error {
	c.closed.Store(true)
	c.transport.CloseIdleConnections()
	c.logger.Debug("files.offline.source.stopped", logger.String("owner", "files.offline"), logger.String("phase", "stopped"))
	return ctx.Err()
}

func sourceFailure(code model.DownloadFailure, cause error) error {
	return &service.DownloadSourceError{Failure: code, Cause: cause}
}

// Normalize 不做DNS或网络I/O；实际连接仍须重新校验所有解析结果。
func (c *Client) Normalize(raw string) (string, string, error) {
	raw = strings.TrimSpace(raw)
	if len(raw) == 0 || len(raw) > model.MaxDownloadURLBytes || !utf8.ValidString(raw) {
		return "", "", sourceFailure(model.DownloadFailureBlocked, model.ErrInvalid)
	}
	for _, r := range raw {
		if unicode.IsControl(r) || unicode.IsSpace(r) {
			return "", "", sourceFailure(model.DownloadFailureBlocked, model.ErrInvalid)
		}
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", "", sourceFailure(model.DownloadFailureBlocked, err)
	}
	parsed.Scheme = strings.ToLower(parsed.Scheme)
	if (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.Opaque != "" || parsed.User != nil || parsed.Hostname() == "" || strings.Contains(parsed.Hostname(), "%") || len(parsed.Hostname()) > sourceMaxHostnameBytes {
		return "", "", sourceFailure(model.DownloadFailureBlocked, model.ErrInvalid)
	}
	if port := parsed.Port(); port != "" {
		number, err := strconv.Atoi(port)
		if err != nil || number < 1 || number > 65535 {
			return "", "", sourceFailure(model.DownloadFailureBlocked, model.ErrInvalid)
		}
	}
	if address, err := netip.ParseAddr(parsed.Hostname()); err == nil && !c.permitted(address) {
		return "", "", sourceFailure(model.DownloadFailureBlocked, nil)
	}
	parsed.Fragment = ""
	parsed.RawFragment = ""
	normalized := parsed.String()
	if len(normalized) > model.MaxDownloadURLBytes {
		return "", "", sourceFailure(model.DownloadFailureBlocked, model.ErrInvalid)
	}
	return normalized, parsed.Scheme + "://" + parsed.Host, nil
}
func (c *Client) permitted(address netip.Addr) bool {
	if !address.IsValid() || address.Zone() != "" {
		return false
	}
	address = address.Unmap()
	if address.IsUnspecified() || address.IsMulticast() {
		return false
	}
	for _, metadata := range c.metadata {
		if address == metadata {
			return false
		}
	}
	// 转换前缀可以携带私网IPv4，不能通过额外CIDR许可跳过实际目的地限制。
	if address.Is6() && !address.IsLoopback() {
		for _, prefix := range c.transitions {
			if prefix.Contains(address) {
				return false
			}
		}
	}
	for _, prefix := range c.allowed {
		if prefix.Contains(address) {
			return true
		}
	}
	if !address.IsGlobalUnicast() || address.IsPrivate() || address.IsLoopback() || address.IsLinkLocalUnicast() {
		return false
	}
	for _, prefix := range c.blocked {
		if prefix.Contains(address) {
			return false
		}
	}
	return true
}
func (c *Client) dial(ctx context.Context, network, address string) (net.Conn, error) {
	if c.closed.Load() {
		return nil, model.ErrDownloadUnavailable
	}
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, sourceFailure(model.DownloadFailureBlocked, err)
	}
	lifetime, cancel := context.WithTimeout(ctx, c.policy.ConnectTimeout)
	defer cancel()
	addresses, err := c.resolver.LookupNetIP(lifetime, "ip", host)
	if err != nil {
		return nil, sourceFailure(model.DownloadFailureNetwork, err)
	}
	if len(addresses) == 0 || len(addresses) > c.policy.DNSAddresses {
		return nil, sourceFailure(model.DownloadFailureBlocked, nil)
	}
	for _, ip := range addresses {
		if !c.permitted(ip) {
			return nil, sourceFailure(model.DownloadFailureBlocked, nil)
		}
	}
	var joined error
	for _, ip := range addresses {
		connection, err := c.connector.DialContext(lifetime, network, net.JoinHostPort(ip.Unmap().String(), port))
		if err == nil {
			return connection, nil
		}
		joined = errors.Join(joined, err)
	}
	return nil, sourceFailure(model.DownloadFailureNetwork, joined)
}
