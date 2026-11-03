// Package repo 实现 Auth 低敏审计事件的持久化窄适配。
package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

const auditEventTable = "auth_audit_events"

func IsNotFound(err error) bool { return errors.Is(err, database.ErrNotFound) }

// Access 是 Auth repo 使用的项目数据库契约窄面。
type Access interface {
	Use(context.Context, func(database.Client) error) error
	WithinTx(context.Context, func(context.Context, database.Client, database.Tx) error) error
}

// AuditEventRecord 只保存脱敏后的低基数字段；不得包含 token、claims、
// 完整 DSN、原始 URL 或对象内容。
type AuditEventRecord struct {
	ID            uint64
	OccurredAt    time.Time
	CorrelationID string
	Operation     string
	Action        string
	ActorKind     string
	SubjectHash   string
	ResourceType  string
	ResourceHash  string
	Decision      string
	Outcome       string
}

// AuditFilter 是查询的低敏过滤条件；空字段表示不过滤。
type AuditFilter struct {
	CorrelationID string
	Operation     string
	Action        string
	Outcome       string
	ActorKind     string
	SubjectHash   string
	ResourceType  string
	Since         *time.Time
	Until         *time.Time
}

type Store struct{ access Access }

func New(access Access) (*Store, error) {
	if access == nil {
		return nil, fmt.Errorf("auth audit database access is nil")
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

func (unit *Unit) CreateAuditEvent(ctx context.Context, value *AuditEventRecord) error {
	return unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(auditEventTable).Create(value).Error })
}

func (unit *Unit) AuditEventByID(ctx context.Context, eventID uint64) (AuditEventRecord, error) {
	var record AuditEventRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(auditEventTable).Where("id = ?", eventID).First(&record).Error
	})
	return record, err
}

func (unit *Unit) CountAuditEvents(ctx context.Context, filter AuditFilter) (int64, error) {
	var count int64
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		query := db.Table(auditEventTable)
		query = applyAuditFilter(query, filter)
		return query.Count(&count).Error
	})
	return count, err
}

// AuditCursor 是按 (occurredAt,eventId) 倒序翻页的存储层稳定位置。
type AuditCursor struct {
	OccurredAt time.Time
	EventID    uint64
}

// ListAuditEventsAfter 返回按 (occurredAt,id) 倒序、在 cursor 之前的 limit 条
// 事件；cursor 为空表示从最新开始。limit+1 探测由调用方决定是否还有下一页。
func (unit *Unit) ListAuditEventsAfter(ctx context.Context, filter AuditFilter, cursor *AuditCursor, limit int) ([]AuditEventRecord, error) {
	var records []AuditEventRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		query := db.Table(auditEventTable)
		query = applyAuditFilter(query, filter)
		if cursor != nil {
			query = query.Where("occurred_at < ? OR (occurred_at = ? AND id < ?)", cursor.OccurredAt.UTC(), cursor.OccurredAt.UTC(), cursor.EventID)
		}
		return query.Order("occurred_at DESC, id DESC").Limit(limit).Find(&records).Error
	})
	return records, err
}

// DeleteOldestAuditEvents 删除最旧的 count 条事件，保证保留上限有界；
// count<=0 时为 no-op。排序按 (occurred_at, id) 升序取最早记录。
func (unit *Unit) DeleteOldestAuditEvents(ctx context.Context, count int64) error {
	if count <= 0 {
		return nil
	}
	return unit.useDB(ctx, func(db *gorm.DB) error {
		var ids []uint64
		if err := db.Table(auditEventTable).Order("occurred_at ASC, id ASC").Limit(int(count)).Pluck("id", &ids).Error; err != nil {
			return err
		}
		if len(ids) == 0 {
			return nil
		}
		return db.Table(auditEventTable).Where("id IN ?", ids).Delete(nil).Error
	})
}

func applyAuditFilter(query *gorm.DB, filter AuditFilter) *gorm.DB {
	if filter.CorrelationID != "" {
		query = query.Where("correlation_id = ?", filter.CorrelationID)
	}
	if filter.Operation != "" {
		query = query.Where("operation = ?", filter.Operation)
	}
	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}
	if filter.Outcome != "" {
		query = query.Where("outcome = ?", filter.Outcome)
	}
	if filter.ActorKind != "" {
		query = query.Where("actor_kind = ?", filter.ActorKind)
	}
	if filter.SubjectHash != "" {
		query = query.Where("subject_hash = ?", filter.SubjectHash)
	}
	if filter.ResourceType != "" {
		query = query.Where("resource_type = ?", filter.ResourceType)
	}
	if filter.Since != nil {
		query = query.Where("occurred_at >= ?", filter.Since.UTC())
	}
	if filter.Until != nil {
		query = query.Where("occurred_at <= ?", filter.Until.UTC())
	}
	return query
}
