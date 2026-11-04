package model

import "time"

// ConnectionState 表达独立设备凭据的状态；到期和根失效由当前事实计算。
type ConnectionState string

const (
	ConnectionActive   ConnectionState = "active"
	ConnectionDisabled ConnectionState = "disabled"
	ConnectionRevoked  ConnectionState = "revoked"
)

func (s ConnectionState) Valid() bool {
	return s == ConnectionActive || s == ConnectionDisabled || s == ConnectionRevoked
}

// Connection 绑定本账号根目录与高熵凭据；摘要和owner不属于公开管理响应。
type Connection struct {
	ID               string
	OwnerID          string
	Name             string
	RootID           string
	ReadOnly         bool
	BlockSystemFiles bool
	SecretDigest     string
	State            ConnectionState
	ExpiresAt        time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
	Revision         int64
}
