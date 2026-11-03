// Package alerting 定义项目自有安全告警契约与 Webhook 实现（079）。
//
// Event 是低敏安全事件载荷：只携带稳定 type/severity/summary 与资源摘要，
// 不携带 token、密码、IP 全文、URL query 或配置密钥。WebhookNotifier 使用
// 标准库 HTTP 发送 JSON 并支持可选 HMAC-SHA256 签名头；发送失败向上返回
// 错误由调用方低敏记录，不阻断业务（与审计写失败语义一致）。
package alerting

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Severity 是告警事件的低基数严重等级。
type Severity string

const (
	SeverityInfo     Severity = "info"
	SeverityWarning  Severity = "warning"
	SeverityCritical Severity = "critical"
)

// Event 是低敏安全告警事件。Summary 由调用方提供受控文案（常量或模板），
// 禁止拼接原始参数；ResourceType/ResourceIDHash 沿用审计摘要语义。
type Event struct {
	Type           string
	Severity       Severity
	Summary        string
	OccurredAt     time.Time
	ResourceType   string
	ResourceIDHash string
}

// Notifier 是安全事件汇报窄契约；实现失败必须返回错误且不影响调用方业务。
type Notifier interface {
	Notify(context.Context, Event) error
}

// WebhookConfig 是 Webhook 通知通道的受控配置。
type WebhookConfig struct {
	URL        string
	SigningKey string
	Timeout    time.Duration
	Retries    int
	RetryDelay time.Duration
}

// Validate 校验 Webhook 配置；SigningKey 与 URL 不进入任何错误文本。
func (c WebhookConfig) Validate() error {
	if c.Timeout <= 0 {
		return errors.New("alerting webhook timeout must be positive")
	}
	if c.Retries < 0 || c.RetryDelay < 0 {
		return errors.New("alerting webhook retry budgets are invalid")
	}
	parsed, err := url.Parse(c.URL)
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return errors.New("alerting webhook URL is invalid")
	}
	if parsed.Scheme != "https" && !(parsed.Scheme == "http" && parsed.Hostname() == "127.0.0.1") {
		return errors.New("alerting webhook URL must use HTTPS or HTTP loopback")
	}
	return nil
}

// webhookPayload 是发送到通道的 JSON 载荷（低敏白名单字段）。
type webhookPayload struct {
	Type           string `json:"type"`
	Severity       string `json:"severity"`
	Summary        string `json:"summary"`
	OccurredAt     string `json:"occurredAt"`
	ResourceType   string `json:"resourceType,omitempty"`
	ResourceIDHash string `json:"resourceIdHash,omitempty"`
}

// WebhookNotifier 是 Notifier 的 Webhook 实现（标准库、同步、可重试）。
type WebhookNotifier struct {
	client   *http.Client
	config   WebhookConfig
	endpoint string
	signing  []byte
}

// NewWebhookNotifier 构造校验后的 WebhookNotifier。
func NewWebhookNotifier(config WebhookConfig) (*WebhookNotifier, error) {
	if err := config.Validate(); err != nil {
		return nil, err
	}
	endpoint := strings.TrimSpace(config.URL)
	var signing []byte
	if key := strings.TrimSpace(config.SigningKey); key != "" {
		signing = []byte(key)
	}
	return &WebhookNotifier{
		client:   &http.Client{Timeout: config.Timeout},
		config:   config,
		endpoint: endpoint,
		signing:  signing,
	}, nil
}

// Notify 发送事件；签名 key 非空时携带 X-Alert-Signature（hex HMAC-SHA256 于 body）。
func (n *WebhookNotifier) Notify(ctx context.Context, event Event) error {
	if n == nil {
		return errors.New("alerting webhook notifier is nil")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(event.Type) == "" {
		return errors.New("alerting event type is empty")
	}
	occurredAt := event.OccurredAt
	if occurredAt.IsZero() {
		occurredAt = time.Now().UTC()
	}
	payload, err := json.Marshal(webhookPayload{Type: event.Type, Severity: string(event.Severity), Summary: event.Summary, OccurredAt: occurredAt.UTC().Format(time.RFC3339Nano), ResourceType: event.ResourceType, ResourceIDHash: event.ResourceIDHash})
	if err != nil {
		return fmt.Errorf("encode alerting event: %w", err)
	}
	attempts := n.config.Retries + 1
	var lastErr error
	for attempt := 0; attempt < attempts; attempt++ {
		if attempt > 0 {
			if err := sleepContext(ctx, n.config.RetryDelay); err != nil {
				return err
			}
		}
		lastErr = n.post(ctx, payload)
		if lastErr == nil {
			return nil
		}
	}
	return lastErr
}

func (n *WebhookNotifier) post(ctx context.Context, payload []byte) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, n.endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("build alerting webhook request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	if len(n.signing) > 0 {
		mac := hmac.New(sha256.New, n.signing)
		mac.Write(payload)
		request.Header.Set("X-Alert-Signature", hex.EncodeToString(mac.Sum(nil)))
	}
	response, err := n.client.Do(request)
	if err != nil {
		return fmt.Errorf("send alerting webhook: %w", err)
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return nil
	}
	return fmt.Errorf("alerting webhook status %d", response.StatusCode)
}

func sleepContext(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

var _ Notifier = (*WebhookNotifier)(nil)
