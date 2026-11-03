package repo

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
)

const authorizationStateTable = "iam_authorization_state"

// AuthorizationSingletonID 是 authorization state 单例行的固定主键。
const AuthorizationSingletonID = 1

var (
	// ErrAuthorizationStateMissing 表示 authorization state 单例行缺失；
	// 任何授权 mutation 与启动加载都 fail closed，不自动补建。
	ErrAuthorizationStateMissing = errors.New("iam authorization state is missing")
)

// AuthorizationStateRecord 是 authorization revision 单例投影。
type AuthorizationStateRecord struct {
	ID        int64
	Revision  uint64
	UpdatedAt time.Time
}

// CurrentAuthorizationRevision 读取当前 authorization revision；属于
// 只读快照路径，必须在同一数据库边界内与 policy 数据一致使用。
func (unit *Unit) CurrentAuthorizationRevision(ctx context.Context) (uint64, error) {
	var record AuthorizationStateRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(authorizationStateTable).Where("id = ?", AuthorizationSingletonID).First(&record).Error
	})
	return record.Revision, err
}

// UpdateAuthorizationRevision 在调用方事务内原子递增 authorization revision
// 并返回新值。单例行缺失时返回 ErrAuthorizationStateMissing，保证任何
// 授权关系变更都不会发生在没有 revision 状态可追踪的数据库上。
func (unit *Unit) UpdateAuthorizationRevision(ctx context.Context, now time.Time) (uint64, error) {
	var record AuthorizationStateRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		result := db.Table(authorizationStateTable).
			Where("id = ?", AuthorizationSingletonID).
			UpdateColumns(map[string]any{"revision": gorm.Expr("revision + 1"), "updated_at": now})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrAuthorizationStateMissing
		}
		return db.Table(authorizationStateTable).
			Where("id = ?", AuthorizationSingletonID).
			Select("revision").
			Scan(&record).Error
	})
	return record.Revision, err
}
