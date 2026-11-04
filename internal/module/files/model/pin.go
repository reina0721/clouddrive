package model

import "time"

// PinKind 只允许可由files验证的业务目标，不保存任意地址。
type PinKind string

const (
	PinFolder   PinKind = "folder"
	PinShared   PinKind = "shared"
	PinShortcut PinKind = "shortcut"
)

func (kind PinKind) Valid() bool {
	return kind == PinFolder || kind == PinShared || kind == PinShortcut
}

// Pin 保存目标身份及顺序，显示名称和可用性由当前事实派生。
type Pin struct {
	ID         string
	OwnerID    string
	TargetKind PinKind
	TargetID   string
	Position   int
	CreatedAt  time.Time
}
