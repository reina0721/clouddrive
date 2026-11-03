// Package totp 是 IAM 对 RFC 6238/4226 TOTP 的 module-owned 窄实现。
//
// 自研理由（R078-002）：TOTP 算法为公开标准（RFC 6238），采用标准库
// （crypto/hmac、crypto/sha1、crypto/rand、encoding/base32）即可实现，
// RFC 6238 附录 B 提供官方测试向量可自动化验证与 Google Authenticator 等
// 标准验证器互通；第三方候选（pquerna/otp）在立项复核时无法在线确认维护
// 状态，不引入。本包只暴露项目自有值对象与校验函数，不泄露任何外部类型。
package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	// PeriodSeconds 是 TOTP 时间步长（RFC 6238 默认 30s）。
	PeriodSeconds = 30
	// Digits 是 TOTP 码位数（RFC 4226 默认 6 位）。
	Digits = 6
	// SecretBytes 是推荐使用的种子长度（RFC 6238 至少 128-bit，取 160-bit）。
	SecretBytes = 20
	// DefaultWindow 是默认允许的时钟容差步数（±1）。
	DefaultWindow = 1
)

// ErrInvalidSecret 表示 base32 种子无法解码。
var ErrInvalidSecret = errors.New("totp secret is invalid")

// GenerateSecret 返回 RFC 4648 base32（无 padding）编码的随机种子，可直接
// 放入 otpauth URI 供验证器 app 使用。
func GenerateSecret() (string, error) {
	raw := make([]byte, SecretBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate totp secret: %w", err)
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(raw), nil
}

// URI 构造 otpauth://totp/ 规范 URI（issuer 与账号会被 percent-encode）。
func URI(issuer, accountName, secret string) string {
	label := url.PathEscape(issuer + ":" + accountName)
	query := url.Values{}
	query.Set("secret", secret)
	query.Set("issuer", issuer)
	query.Set("algorithm", "SHA1")
	query.Set("digits", "6")
	query.Set("period", "30")
	return "otpauth://totp/" + label + "?" + query.Encode()
}

// CodeAt 计算 secret 在时刻 at 的 TOTP 码（RFC 6238：HOTP(K, floor(at/30))）。
func CodeAt(secret string, at time.Time) (string, error) {
	key, err := decodeSecret(secret)
	if err != nil {
		return "", err
	}
	counter := uint64(at.Unix() / PeriodSeconds)
	message := make([]byte, 8)
	binary.BigEndian.PutUint64(message, counter)
	mac := hmac.New(sha1.New, key)
	mac.Write(message)
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	value := (uint32(sum[offset])&0x7f)<<24 |
		uint32(sum[offset+1])<<16 |
		uint32(sum[offset+2])<<8 |
		uint32(sum[offset+3])
	mod := uint32(1)
	for range Digits {
		mod *= 10
	}
	return fmt.Sprintf("%06d", value%mod), nil
}

// Validate 校验 code 是否与 secret 在 at 时刻的前后 window 步内匹配；
// window=0 只接受当前步。调用方负责防重放（记录最近通过的客户端时间）。
func Validate(secret, code string, at time.Time, window int) (bool, error) {
	if strings.TrimSpace(code) == "" {
		return false, nil
	}
	if window < 0 {
		window = DefaultWindow
	}
	for step := -window; step <= window; step++ {
		candidate, err := CodeAt(secret, at.Add(time.Duration(step*PeriodSeconds)*time.Second))
		if err != nil {
			return false, err
		}
		if hmac.Equal([]byte(candidate), []byte(strings.TrimSpace(code))) {
			return true, nil
		}
	}
	return false, nil
}

func decodeSecret(secret string) ([]byte, error) {
	normalized := strings.ToUpper(strings.TrimSpace(secret))
	normalized = strings.TrimRight(normalized, "=")
	decoded, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(normalized)
	if err != nil || len(decoded) == 0 {
		return nil, fmt.Errorf("%w: %v", ErrInvalidSecret, err)
	}
	return decoded, nil
}
