package model

import (
	"errors"
	"time"
)

var ErrShareLocked = errors.New("file share requires a valid grant")

// Share 是用户显式创建的只读 capability，凭据与尝试计数不属于公共响应。
type Share struct {
	ID             string
	OwnerID        string
	RootID         string
	Token          string
	TokenDigest    string
	PasswordHash   string
	CreatedAt      time.Time
	ExpiresAt      time.Time
	RevokedAt      *time.Time
	AttemptWindow  *time.Time
	UnlockAttempts int
}

// ShareGrant 仅保存访问票据的摘要，不将票据视为 IAM 身份。
type ShareGrant struct {
	Digest          string
	ShareID         string
	ExpiresAt       time.Time
	EntryID         string
	ContentRevision int64
}
