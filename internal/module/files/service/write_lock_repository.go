package service

import (
	"context"
	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// WriteLockSnapshot 与目录写入共用同一owner事务，避免锁准入与发布之间的竞态。
type WriteLockSnapshot struct {
	Entries            []model.Entry
	Locks              []model.WriteLock
	Connection         *model.Connection
	GlobalCount        int64
	HistoryPreferences model.HistoryPreferences
	OwnerReservedBytes int64
}

type WriteLockChange struct {
	Upsert           *model.WriteLock
	RemoveID         string
	ExpectedRevision int64
	Entries          []model.Entry
	Authority        model.FileWriteAuthority
}

// WriteLockRepository 不拥有数据库；只允许本人或指定连接在受控事务内变更。
type WriteLockRepository interface {
	ReadWriteLocks(context.Context, string) ([]model.WriteLock, error)
	ChangeWriteLocks(context.Context, string, string, func(WriteLockSnapshot) (WriteLockChange, error)) error
}

// WOPIWriteRepository 在与策略和文件更新共用的事务中检查编辑会话。
type WOPIWriteRepository interface {
	ReadWriteLocks(context.Context, string) ([]model.WriteLock, error)
	ChangeWOPIWriteLocks(context.Context, string, int64, func(WriteLockSnapshot) (WriteLockChange, error)) error
}
