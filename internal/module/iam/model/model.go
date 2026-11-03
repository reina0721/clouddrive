// Package model 定义 IAM 的身份、角色与会话业务模型。
package model

import (
	"errors"
	"net/mail"
	"regexp"
	"strings"
	"time"
	"unicode"

	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

const (
	// OwnerRoleCode 是不可改名、不可归档的系统所有者角色编码。
	OwnerRoleCode    = "owner"
	MinPasswordRunes = 15
	MaxPasswordRunes = 128
)

var (
	ErrInvalidID           = errors.New("iam id is invalid")
	ErrInvalidUsername     = errors.New("iam username is invalid")
	ErrInvalidName         = errors.New("iam name is invalid")
	ErrInvalidPassword     = errors.New("iam password is invalid")
	ErrInvalidTime         = errors.New("iam time is invalid")
	ErrInvalidProfile      = errors.New("iam profile field is invalid")
	ErrInvalidConfirmation = errors.New("iam confirmation is invalid or expired")
	ErrOwnerInvariant      = errors.New("iam owner invariant would be violated")
	usernamePattern        = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$`)
	roleCodePattern        = regexp.MustCompile(`^[a-z][a-z0-9._-]{1,63}$`)
)

type AccountStatus string

const (
	AccountActive   AccountStatus = "active"
	AccountDisabled AccountStatus = "disabled"
)

type Account struct {
	ID, Username, DisplayName string
	// Nickname/Bio/BirthDate 是用户主页资料（072 设置中心 profile 分区；可空）。
	Nickname, Bio, BirthDate  string
	Status                    AccountStatus
	Archived                  bool
	MustChangePassword        bool
	SecurityRevision, Version uint64
	FailedAttempts            int
	LockedUntil               *time.Time
	CreatedAt, UpdatedAt      time.Time
}

type Role struct {
	ID, Code, Name, Description string
	Active, Archived, System    bool
	Version                     uint64
	CreatedAt, UpdatedAt        time.Time
}

type SessionIdentity struct {
	AccountID, Username, DisplayName string
	// Nickname/Bio/BirthDate 是用户主页资料（072），随会话投影。
	Nickname, Bio, BirthDate string
	Permissions              []permissioncatalog.Key
	MustChangePassword       bool
	SecurityRevision         uint64
	AuthenticatedAt          time.Time
}

func NormalizeUsername(value string) (string, error) {
	value = strings.TrimSpace(value)
	if strings.Contains(value, "@") {
		address, err := mail.ParseAddress(value)
		if err != nil || address.Address != value || len(value) > 254 {
			return "", ErrInvalidUsername
		}
		return strings.ToLower(value), nil
	}
	if !usernamePattern.MatchString(value) {
		return "", ErrInvalidUsername
	}
	return strings.ToLower(value), nil
}

func NormalizeRoleCode(value string) (string, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	if !roleCodePattern.MatchString(value) {
		return "", ErrInvalidName
	}
	return value, nil
}

func NormalizeName(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len([]rune(value)) > 128 {
		return "", ErrInvalidName
	}
	return value, nil
}

// PasswordPolicy 是创建/重置/修改密码时的强度策略；由配置注入并在 Service
// 构造时冻结。MinLength/MaxLength 按 rune 计数（与既有 ValidatePassword 一致）。
// HistorySize/MaxPasswordAge 在 Service 层校验（需要数据库），model 只承载值。
type PasswordPolicy struct {
	MinLength int
	MaxLength int
	// RequireComplexity 开启时要求密码同时包含大写字母、小写字母与数字。
	RequireComplexity bool
	// HistorySize 启用时禁止新密码与最近 HistorySize 条历史口令相同（0=不启用）。
	HistorySize int
	// MaxPasswordAge 启用时口令超过该期限的账号登录后进入受限改密（0=不过期）。
	MaxPasswordAge time.Duration
}

// DefaultPasswordPolicy 返回与既有硬编码语义一致的默认策略（15/128、不要求复杂度）。
func DefaultPasswordPolicy() PasswordPolicy {
	return PasswordPolicy{MinLength: MinPasswordRunes, MaxLength: MaxPasswordRunes}
}

func ValidatePasswordWith(value string, policy PasswordPolicy) error {
	if policy.MinLength < 1 || policy.MaxLength < policy.MinLength {
		return ErrInvalidPassword
	}
	size := len([]rune(value))
	if size < policy.MinLength || size > policy.MaxLength {
		return ErrInvalidPassword
	}
	if policy.RequireComplexity {
		upper, lower, digit := false, false, false
		for _, character := range value {
			switch {
			case unicode.IsUpper(character):
				upper = true
			case unicode.IsLower(character):
				lower = true
			case unicode.IsDigit(character):
				digit = true
			}
		}
		if !upper || !lower || !digit {
			return ErrInvalidPassword
		}
	}
	return nil
}

// ValidatePassword 使用默认策略校验密码；默认策略与既有硬编码语义一致。
func ValidatePassword(value string) error {
	return ValidatePasswordWith(value, DefaultPasswordPolicy())
}

func NewAccount(id, username, displayName string, mustChange bool, now time.Time) (Account, error) {
	if err := idgen.Validate(id); err != nil {
		return Account{}, ErrInvalidID
	}
	username, err := NormalizeUsername(username)
	if err != nil {
		return Account{}, err
	}
	displayName, err = NormalizeName(displayName)
	if err != nil {
		return Account{}, err
	}
	if now.IsZero() {
		return Account{}, ErrInvalidTime
	}
	now = now.UTC()
	return Account{ID: id, Username: username, DisplayName: displayName, Status: AccountActive, MustChangePassword: mustChange, SecurityRevision: 1, CreatedAt: now, UpdatedAt: now}, nil
}

func NewRole(id, code, name, description string, system bool, now time.Time) (Role, error) {
	if err := idgen.Validate(id); err != nil {
		return Role{}, ErrInvalidID
	}
	code, err := NormalizeRoleCode(code)
	if err != nil {
		return Role{}, err
	}
	name, err = NormalizeName(name)
	if err != nil {
		return Role{}, err
	}
	if now.IsZero() {
		return Role{}, ErrInvalidTime
	}
	now = now.UTC()
	return Role{ID: id, Code: code, Name: name, Description: strings.TrimSpace(description), Active: true, System: system, CreatedAt: now, UpdatedAt: now}, nil
}

func (a Account) Assignable() bool { return a.Status == AccountActive && !a.Archived }

// AccountName 是账号显示名的受控更新结果；空值表示未变更。
type AccountName struct {
	DisplayName string
}
