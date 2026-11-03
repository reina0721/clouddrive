// Package configbinding 绑定 IAM 本地身份入口的配置。
package configbinding

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/kernel/config"
)

const configPath = "iam"

// PasswordPolicy 是 IAM 本地密码强度策略配置；字段语义见 model.PasswordPolicy。
type PasswordPolicy struct {
	MinLength         int           `mapstructure:"minLength"`
	MaxLength         int           `mapstructure:"maxLength"`
	RequireComplexity bool          `mapstructure:"requireComplexity"`
	HistorySize       int           `mapstructure:"historySize"`
	MaxPasswordAge    time.Duration `mapstructure:"maxPasswordAge"`
}

type Local struct {
	SetupToken            string         `mapstructure:"setupToken"`
	IdleTimeout           time.Duration  `mapstructure:"idleTimeout"`
	AbsoluteTimeout       time.Duration  `mapstructure:"absoluteTimeout"`
	MaxFailedAttempts     int            `mapstructure:"maxFailedAttempts"`
	LockDuration          time.Duration  `mapstructure:"lockDuration"`
	PasswordPolicy        PasswordPolicy `mapstructure:"passwordPolicy"`
	MaxSessionsPerAccount int            `mapstructure:"maxSessionsPerAccount"`
	// ApiTokenMaxPerAccount 是单账号最大未吊销 API 令牌数（080）；0=不限。
	ApiTokenMaxPerAccount int `mapstructure:"apiTokenMaxPerAccount"`
	// ApiTokenDefaultTTL 是创建令牌未指定过期时间时的默认有效期（080）；0=永不过期。
	ApiTokenDefaultTTL time.Duration `mapstructure:"apiTokenDefaultTTL"`
}
type Config struct {
	Local Local `mapstructure:"local"`
}

// defaultPasswordPolicy 与 model 默认策略（15/128、不要求复杂度）保持一致，
// 保证既有配置与存量账号兼容；这里显式声明，避免配置包反向依赖业务 model。
const (
	defaultPasswordMinLength = 15
	defaultPasswordMaxLength = 128
	// maxPasswordMaxLength 是密码最大长度的防御性配置上限。
	maxPasswordMaxLength = 128
)

func Default() Config {
	return Config{Local: Local{IdleTimeout: 30 * time.Minute, AbsoluteTimeout: 12 * time.Hour, MaxFailedAttempts: 5, LockDuration: 15 * time.Minute, PasswordPolicy: PasswordPolicy{MinLength: defaultPasswordMinLength, MaxLength: defaultPasswordMaxLength}, ApiTokenMaxPerAccount: 5}}
}
func Binding() config.Binding {
	return config.Binding{CapabilityID: "module.iam", ConfigPath: configPath, Contract: defaults{}, Validate: func(snapshot config.Snapshot) error { _, err := Decode(snapshot); return err }}
}
func Decode(snapshot config.Snapshot) (Config, error) {
	value := Default()
	if err := snapshot.DecodeSection(configPath, &value); err != nil {
		return Config{}, fmt.Errorf("decode iam configuration: %w", err)
	}
	if value.Local.IdleTimeout <= 0 || value.Local.AbsoluteTimeout <= value.Local.IdleTimeout || value.Local.MaxFailedAttempts <= 0 || value.Local.LockDuration <= 0 {
		return Config{}, fmt.Errorf("iam local security budgets are invalid")
	}
	if value.Local.MaxSessionsPerAccount < 0 {
		return Config{}, fmt.Errorf("iam max sessions per account is invalid")
	}
	if value.Local.ApiTokenMaxPerAccount < 0 || value.Local.ApiTokenDefaultTTL < 0 {
		return Config{}, fmt.Errorf("iam api token limit or default ttl is invalid")
	}
	policy := value.Local.PasswordPolicy
	if policy.MinLength < 1 || policy.MaxLength < policy.MinLength || policy.MaxLength > maxPasswordMaxLength {
		return Config{}, fmt.Errorf("iam password policy is invalid")
	}
	if policy.HistorySize < 0 || policy.MaxPasswordAge < 0 {
		return Config{}, fmt.Errorf("iam password history or age is invalid")
	}
	return value, nil
}

type defaults struct{}

func (defaults) Defaults(ctx context.Context) (config.Object, config.Control, error) {
	if ctx == nil {
		return nil, config.Continue, fmt.Errorf("iam defaults context is nil")
	}
	if err := ctx.Err(); err != nil {
		return nil, config.Continue, err
	}
	v := Default()
	return config.Object{config.FieldOf("local", config.ObjectValue(config.Object{
		config.FieldOf("setupToken", config.String(v.Local.SetupToken)), config.FieldOf("idleTimeout", config.Duration(v.Local.IdleTimeout)), config.FieldOf("absoluteTimeout", config.Duration(v.Local.AbsoluteTimeout)),
		config.FieldOf("maxFailedAttempts", mustNumber(v.Local.MaxFailedAttempts)), config.FieldOf("lockDuration", config.Duration(v.Local.LockDuration)),
		config.FieldOf("maxSessionsPerAccount", mustNumber(v.Local.MaxSessionsPerAccount)),
		config.FieldOf("apiTokenMaxPerAccount", mustNumber(v.Local.ApiTokenMaxPerAccount)), config.FieldOf("apiTokenDefaultTTL", config.Duration(v.Local.ApiTokenDefaultTTL)),
		config.FieldOf("passwordPolicy", config.ObjectValue(config.Object{
			config.FieldOf("minLength", mustNumber(v.Local.PasswordPolicy.MinLength)), config.FieldOf("maxLength", mustNumber(v.Local.PasswordPolicy.MaxLength)),
			config.FieldOf("requireComplexity", config.Bool(v.Local.PasswordPolicy.RequireComplexity)),
			config.FieldOf("historySize", mustNumber(v.Local.PasswordPolicy.HistorySize)), config.FieldOf("maxPasswordAge", config.Duration(v.Local.PasswordPolicy.MaxPasswordAge)),
		})),
	}))}, config.Continue, nil
}
func mustNumber(value int) config.Value {
	number, err := config.Number(fmt.Sprintf("%d", value))
	if err != nil {
		panic(err)
	}
	return number
}

var _ = strings.TrimSpace
