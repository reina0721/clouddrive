// Package repo 实现 IAM 对项目数据库契约的窄适配。
package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

const (
	accountTable         = "iam_accounts"
	credentialTable      = "iam_local_credentials"
	roleTable            = "iam_roles"
	accountRoleTable     = "iam_account_roles"
	rolePermissionTable  = "iam_role_permissions"
	sessionTable         = "iam_sessions"
	passwordHistoryTable = "iam_password_history"
	apiTokenTable        = "iam_api_tokens"
	mfaSecretTable       = "iam_totp_secrets"
	mfaRecoveryCodeTable = "iam_mfa_recovery_codes"
	idempotencyTable     = "iam_idempotency_records"
	userPreferencesTable = "iam_user_preferences"
)

type Access interface {
	Use(context.Context, func(database.Client) error) error
	WithinTx(context.Context, func(context.Context, database.Client, database.Tx) error) error
}

type AccountRecord struct {
	ID, Username, DisplayName, Status string
	// Nickname/Bio/BirthDate 是用户主页资料（072；可空）。
	Nickname, Bio, BirthDate string
	Archived                 bool
	MustChangePassword       bool
	SecurityRevision         uint64
	FailedAttempts           int
	LockedUntil              *time.Time
	Version                  uint64
	CreatedAt, UpdatedAt     time.Time
}
type CredentialRecord struct {
	AccountID, PasswordHash string
	UpdatedAt               time.Time
	// PasswordChangedAt 是最近一次创建/重置/修改口令的时间；maxPasswordAge
	// 过期判定与口令历史写入以它为基准。
	PasswordChangedAt time.Time
}

// PasswordHistoryRecord 是一条口令历史（只存哈希，不存明文）。
type PasswordHistoryRecord struct {
	AccountID    string
	PasswordHash string
	CreatedAt    time.Time
}

// ApiTokenRecord 是机器访问令牌（078/080）：secret 只以 sha256 哈希持久化，
// Scopes 以 JSON 文本存储（service 负责稳定排序编码/解码）；Description 为
// 可选管理说明；DisabledAt 非空表示禁用（可逆状态，080）。
type ApiTokenRecord struct {
	Version     uint64     `gorm:"column:version"`
	ID          string     `gorm:"column:id"`
	AccountID   string     `gorm:"column:account_id"`
	Name        string     `gorm:"column:name"`
	Description string     `gorm:"column:description"`
	TokenHash   string     `gorm:"column:token_hash"`
	Scopes      string     `gorm:"column:scopes"`
	ExpiresAt   *time.Time `gorm:"column:expires_at"`
	DisabledAt  *time.Time `gorm:"column:disabled_at"`
	RevokedAt   *time.Time `gorm:"column:revoked_at"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
	LastUsed    *time.Time `gorm:"column:last_used_at"`
}

// MFASecretRecord 是 TOTP 种子（078）：已确认前为 pending 绑定，确认后不回读明文。
type MFASecretRecord struct {
	AccountID   string
	Secret      string
	Confirmed   bool
	CreatedAt   time.Time
	ConfirmedAt *time.Time
}

// MfaRecoveryCodeRecord 是一次性恢复码（只存哈希；used_at 非空即已作废）。
type MfaRecoveryCodeRecord struct {
	AccountID string
	CodeHash  string
	UsedAt    *time.Time
}
type RoleRecord struct {
	ID, Code, Name, Description string
	Active, Archived, System    bool
	Version                     uint64
	CreatedAt, UpdatedAt        time.Time
}
type AccountRoleRecord struct {
	AccountID, RoleID string
	Active            bool
	UpdatedAt         time.Time
}
type RolePermissionRecord struct {
	RoleID, PermissionKey string
	Active                bool
	UpdatedAt             time.Time
}

// IdempotencyRecord 保存批量写操作的稳定结果，避免客户端重试重复执行。
type IdempotencyRecord struct {
	Operation, IdempotencyKey, RequestHash string
	ResultJSON                             string
	Completed                              bool
	CreatedAt                              time.Time
}

// UserPreferenceRecord 是账号的跨设备偏好覆盖（BE-090-005）：只存用户显式
// 修改的键值对（JSON 文本），缺失键由 service 层用默认值补齐后返回。
type UserPreferenceRecord struct {
	Version         uint64
	AccountID       string
	PreferencesJSON string
	UpdatedAt       time.Time
}
type SessionRecord struct {
	IDHash                                                  []byte
	AccountID                                               string
	CSRFHash                                                []byte
	SecurityRevision                                        uint64
	CreatedAt, LastSeenAt, IdleExpiresAt, AbsoluteExpiresAt time.Time
	RevokedAt                                               *time.Time
	MfaVerified                                             bool
}

type Store struct{ access Access }

func New(access Access) (*Store, error) {
	if access == nil {
		return nil, fmt.Errorf("iam database access is nil")
	}
	return &Store{access: access}, nil
}

func (store *Store) Use(ctx context.Context, use func(*Unit) error) error {
	return store.access.Use(ctx, func(client database.Client) error {
		return use(&Unit{client: client})
	})
}

func (store *Store) WithinTx(ctx context.Context, use func(context.Context, *Unit) error) error {
	return store.access.WithinTx(ctx, func(txCtx context.Context, client database.Client, tx database.Tx) error {
		return use(txCtx, &Unit{client: client, tx: tx})
	})
}

type Unit struct {
	client database.Client
	tx     database.Tx
}

func (unit *Unit) useDB(ctx context.Context, use func(*gorm.DB) error) error {
	if unit.tx != nil {
		return database.UseGORMTx(ctx, unit.tx, use)
	}
	return database.UseGORM(ctx, unit.client, use)
}
