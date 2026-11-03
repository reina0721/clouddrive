// Package alerting 是底层安全告警 App 组件：把 pkg/alerting 的 Webhook
// 实现声明为可配置、可租约、带生命周期治理的 kernel 组件，输出稳定 Notifier。
package alerting

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/kernel/config"
)

// ConfigPath 是 alerting 配置节路径。
const ConfigPath = "alerting"

// Config 是安全告警通道的受控配置（URL/密钥属配置秘密，不进入日志与审计）。
type Config struct {
	Enabled    bool          `mapstructure:"enabled"`
	WebhookURL string        `mapstructure:"webhookUrl"`
	SigningKey string        `mapstructure:"signingKey"`
	Timeout    time.Duration `mapstructure:"timeout"`
	Retries    int           `mapstructure:"retries"`
	RetryDelay time.Duration `mapstructure:"retryDelay"`
	QueueSize  int           `mapstructure:"queueSize"`
}

// DefaultConfig 返回默认关闭的安全配置（enabled=false 零行为变化）。
func DefaultConfig() Config {
	return Config{Timeout: 5 * time.Second, Retries: 1, RetryDelay: time.Second, QueueSize: 256}
}

func decode(snapshot config.Snapshot) (Config, error) {
	resolved := DefaultConfig()
	if err := snapshot.DecodeSection(ConfigPath, &resolved); err != nil {
		return Config{}, fmt.Errorf("decode alerting configuration: %w", err)
	}
	if err := validateConfig(resolved); err != nil {
		return Config{}, err
	}
	return resolved, nil
}

func validateConfig(value Config) error {
	if value.QueueSize <= 0 || value.Timeout <= 0 || value.Retries < 0 || value.RetryDelay < 0 {
		return fmt.Errorf("alerting queue, timeout or retry budgets are invalid")
	}
	if !value.Enabled {
		return nil
	}
	parsed, err := url.Parse(strings.TrimSpace(value.WebhookURL))
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return fmt.Errorf("alerting webhook URL is invalid")
	}
	if parsed.Scheme != "https" && !(parsed.Scheme == "http" && loopbackHost(parsed.Hostname())) {
		return fmt.Errorf("alerting webhook URL must use HTTPS or HTTP loopback")
	}
	return nil
}

func loopbackHost(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}
	return strings.HasPrefix(host, "127.") || strings.HasPrefix(host, "::1")
}

// Configuration 返回 alerting 配置节的唯一 authority。
func Configuration() config.Binding {
	return config.Binding{
		CapabilityID: string(AlertingID), ConfigPath: ConfigPath, Contract: defaults{},
		Validate: func(snapshot config.Snapshot) error { _, err := decode(snapshot); return err },
	}
}

type defaults struct{}

func (defaults) Defaults(ctx context.Context) (config.Object, config.Control, error) {
	if ctx == nil {
		return nil, config.Continue, fmt.Errorf("alerting defaults context is nil")
	}
	if err := ctx.Err(); err != nil {
		return nil, config.Continue, err
	}
	value := DefaultConfig()
	return config.Object{
		config.FieldOf("enabled", config.Bool(value.Enabled)),
		config.FieldOf("webhookUrl", config.String(value.WebhookURL)),
		config.FieldOf("signingKey", config.String(value.SigningKey)),
		config.FieldOf("timeout", config.Duration(value.Timeout)),
		config.FieldOf("retries", mustNumber(value.Retries)),
		config.FieldOf("retryDelay", config.Duration(value.RetryDelay)),
		config.FieldOf("queueSize", mustNumber(value.QueueSize)),
	}, config.Continue, nil
}

func mustNumber(value int) config.Value {
	number, err := config.Number(fmt.Sprintf("%d", value))
	if err != nil {
		panic("invalid compile-time alerting default: " + fmt.Sprint(value))
	}
	return number
}

var _ config.DefaultContract = defaults{}
