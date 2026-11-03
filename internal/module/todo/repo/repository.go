// Package repo 实现 Todo 的数据库 Repository port。
package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/internal/module/todo/model"
	"github.com/reina0721/clouddrive/internal/module/todo/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/fault"
	"gorm.io/gorm"
)

const todoTable = "todos"

// Record 是 Todo 的持久化模型；它不向 Service 或协议边界传播。
type Record struct {
	ID           string
	Title        string
	Status       string
	CreatedAt    time.Time
	UpdatedAt    time.Time
	CompletedAt  *time.Time
	Version      uint64
	OwnerSubject string
}

// Access 是 Todo Database Adapter 使用方拥有的稳定租约契约。
type Access interface {
	Use(context.Context, func(database.Client) error) error
	WithinTx(context.Context, func(context.Context, database.Client, database.Tx) error) error
}

// Repository 使用稳定 Database Access 实现 Todo 持久化。
type Repository struct {
	access Access
}

// New 创建不获取数据库租约的 Repository。
func New(access Access) (*Repository, error) {
	if access == nil {
		return nil, fmt.Errorf("todo database access is nil")
	}
	return &Repository{access: access}, nil
}

// Create 创建 Todo。
func (r *Repository) Create(ctx context.Context, todo model.Todo) (model.Todo, error) {
	record := recordFromModel(todo)
	record.Version = 1
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error { return db.Table(todoTable).Create(&record).Error })
	})
	if err != nil {
		return model.Todo{}, translate(err, "todo.repo.create")
	}
	return modelFromRecord(record)
}

// Get 按 ID 查询 Todo。
func (r *Repository) Get(ctx context.Context, id string) (model.Todo, error) {
	var record Record
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error { return db.Table(todoTable).Where("id = ?", id).First(&record).Error })
	})
	if err != nil {
		return model.Todo{}, translate(err, "todo.repo.get")
	}
	return modelFromRecord(record)
}

// List 在一个事务快照内返回分页数据和总数。
func (r *Repository) List(ctx context.Context, filter service.ListFilter) ([]model.Todo, int64, error) {
	var records []Record
	var total int64
	err := r.access.WithinTx(ctx, func(txCtx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(txCtx, tx, func(db *gorm.DB) error {
			query := db.Table(todoTable).Where("owner_subject = ?", filter.OwnerSubject)
			if filter.Status != nil {
				query = query.Where("status = ?", string(*filter.Status))
			}
			if err := query.Count(&total).Error; err != nil {
				return err
			}
			return query.Order("created_at DESC").Order("id ASC").Offset(filter.Offset).Limit(filter.Limit).Find(&records).Error
		})
	})
	if err != nil {
		return nil, 0, translate(err, "todo.repo.list")
	}
	items := make([]model.Todo, len(records))
	for index, record := range records {
		converted, err := modelFromRecord(record)
		if err != nil {
			return nil, 0, err
		}
		items[index] = converted
	}
	return items, total, nil
}

// Save 使用 ID 与 Version 原子保存 Todo 状态。
func (r *Repository) Save(ctx context.Context, todo model.Todo) (model.Todo, error) {
	var record Record
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			result := db.Table(todoTable).Where("id = ? AND version = ?", todo.ID, todo.Version).Updates(map[string]any{"status": string(todo.Status), "updated_at": todo.UpdatedAt, "completed_at": todo.CompletedAt, "version": gorm.Expr("version + 1")})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return database.ErrOptimisticConflict
			}
			return db.Table(todoTable).Where("id = ?", todo.ID).First(&record).Error
		})
	})
	if err != nil {
		return model.Todo{}, translate(err, "todo.repo.save")
	}
	return modelFromRecord(record)
}

func recordFromModel(todo model.Todo) Record {
	return Record{
		ID: todo.ID, Title: todo.Title, Status: string(todo.Status), CreatedAt: todo.CreatedAt,
		UpdatedAt: todo.UpdatedAt, CompletedAt: todo.CompletedAt, Version: todo.Version,
		OwnerSubject: todo.OwnerSubject,
	}
}

func modelFromRecord(record Record) (model.Todo, error) {
	status, err := model.ParseStatus(record.Status)
	if err != nil {
		return model.Todo{}, fault.Wrap(err, fault.CodeInternal, "todo.repo.record.status", false)
	}
	result, err := model.Restore(model.Todo{
		ID: record.ID, Title: record.Title, Status: status, CreatedAt: record.CreatedAt,
		UpdatedAt: record.UpdatedAt, CompletedAt: record.CompletedAt, Version: record.Version,
		OwnerSubject: record.OwnerSubject,
	})
	if err != nil {
		return model.Todo{}, fault.Wrap(err, fault.CodeInternal, "todo.repo.record", false)
	}
	return result, nil
}

func translate(err error, operation string) error {
	code := fault.CodeInternal
	retryable := false
	switch {
	case errors.Is(err, database.ErrNotFound):
		code = fault.CodeNotFound
	case errors.Is(err, database.ErrDuplicateKey), errors.Is(err, database.ErrOptimisticConflict):
		code = fault.CodeConflict
	case errors.Is(err, database.ErrClientUnavailable), errors.Is(err, database.ErrOperationFailed):
		code, retryable = fault.CodeUnavailable, true
	case errors.Is(err, context.Canceled):
		code = fault.CodeCanceled
	case errors.Is(err, context.DeadlineExceeded):
		code = fault.CodeTimeout
	}
	return fault.Wrap(err, code, operation, retryable)
}

var _ service.Repository = (*Repository)(nil)
