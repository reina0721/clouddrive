package model

import (
	"errors"
	"time"
)

var ErrShareLocked = errors.New("file share requires a valid grant")

// Share 是用户显式创建的范围能力；策略版本与票据绑定，凭据不属于访客响应。
type Share struct {
	Audience       AudiencePolicy
	Title          string
	State          ShareState
	Permissions    SharePermission
	Revision       int64
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
	AudienceSubject string
	ShareRevision   int64
	Digest          string
	ShareID         string
	ExpiresAt       time.Time
	EntryID         string
	ContentRevision int64
}
