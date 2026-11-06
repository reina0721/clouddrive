package service

import (
	"context"
	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// ConnectionSnapshot 是同一owner事务内的策略与目录事实，不包含第三方类型。
type ConnectionSnapshot struct {
	Entries            []model.Entry
	Current            *model.Connection
	ActiveCount        int64
	EntriesUnavailable bool
}
type ConnectionPage struct {
	Items      []model.Connection
	NextCursor string
}

type ConnectionFileSnapshot struct {
	HistoryPreferences model.HistoryPreferences
	Connection         model.Connection
	Entries            []model.Entry
}

type ConnectionRepository interface {
	ReadConnection(context.Context, string) (model.Connection, error)
	ConnectionEntries(context.Context, string) ([]model.Entry, error)
	ListConnections(context.Context, string, string, int) (ConnectionPage, error)
	ChangeConnection(context.Context, string, string, func(ConnectionSnapshot) (model.Connection, error)) (model.Connection, error)
	ChangeConnectionFiles(context.Context, string, int64, func(ConnectionFileSnapshot) ([]model.Entry, error)) ([]model.Entry, error)
}

// ConnectionAccess 只区分当前操作所需的精确权限，不表示连接配置状态。
type ConnectionAccess string

const (
	ConnectionRead  ConnectionAccess = "read"
	ConnectionWrite ConnectionAccess = "write"
)

type ConnectionAuthorizer interface {
	AuthorizeConnection(context.Context, string, ConnectionAccess) (bool, error)
}
