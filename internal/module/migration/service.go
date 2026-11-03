// Package migration 编排显式多 migration set 的 status/up/compatibility 用例，不拥有业务 SQL。
package migration

import (
	"context"
	"errors"
	"fmt"
	"sort"

	configbinding "github.com/reina0721/clouddrive/internal/module/migration/binding/config"
	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
)

var (
	// ErrCompletionRequired 表示版本已到 target，但模块数据完成门禁尚未通过。
	ErrCompletionRequired = dbmigrate.ErrCompletionRequired
	// ErrPreReleaseBaselineResetRequired 表示检测到已退休的未发布 baseline，拒绝自动迁移或删除。
	ErrPreReleaseBaselineResetRequired = errors.New("pre-release migration baseline reset is required")
)

// SetStatus 保留单个 module-owned migration set 的身份与状态。
type SetStatus struct {
	ModuleID   string `json:"moduleId"`
	SetName    string `json:"setName"`
	Current    uint   `json:"current"`
	Target     uint   `json:"target"`
	Dirty      bool   `json:"dirty"`
	Empty      bool   `json:"empty"`
	Compatible bool   `json:"compatible"`
}

// Status 是 CLI 与 readiness 共用的应用级聚合状态。
type Status struct {
	Sets       []SetStatus `json:"sets"`
	Compatible bool        `json:"compatible"`
}

// Runner 是 Service 使用方定义的通用迁移执行端口。
type Runner interface {
	Status(context.Context) (dbmigrate.Status, error)
	Up(context.Context) error
	Close() error
}

// Factory 为每个 set 的每次 one-shot operation 创建独占资源。
type Factory func(context.Context, dbmigrate.Config, dbmigrate.Set) (Runner, error)

// Preflight 在创建 runner 或执行 SQL 前只读检查退休 baseline。
type Preflight func(context.Context, database.Config, Catalog) error

// Service 执行显式 Catalog 中的多个 module-owned migration set。
type Service struct {
	database  database.Config
	config    configbinding.Config
	catalog   Catalog
	factory   Factory
	preflight Preflight
}

// New 构造无 I/O 的 Migration Service。
func New(databaseConfig database.Config, config configbinding.Config, catalog Catalog, factory Factory, preflight Preflight) (*Service, error) {
	if err := database.ValidateConfig(&databaseConfig); err != nil {
		return nil, fmt.Errorf("validate migration database config: %w", err)
	}
	if config.LockTimeout <= 0 || config.OperationTimeout <= 0 || config.LockTimeout >= config.OperationTimeout {
		return nil, fmt.Errorf("migration service budgets are invalid")
	}
	if len(catalog.registrations) == 0 || factory == nil || preflight == nil {
		return nil, fmt.Errorf("migration service dependencies are incomplete")
	}
	return &Service{database: databaseConfig, config: config, catalog: catalog, factory: factory, preflight: preflight}, nil
}

// Status 只读聚合全部 set 状态，并计算应用是否精确兼容。
func (s *Service) Status(ctx context.Context) (Status, error) {
	return s.withTimeout(ctx, func(operationCtx context.Context) (Status, error) {
		if err := s.preflight(operationCtx, s.database, s.catalog); err != nil {
			return Status{}, err
		}
		result := Status{Sets: make([]SetStatus, 0, len(s.catalog.registrations)), Compatible: true}
		for _, registration := range s.catalog.registrations {
			current, err := dbmigrate.ReadStatus(operationCtx, s.database, registration.Set)
			if err != nil {
				return Status{}, fmt.Errorf("read migration status for module %q set %q: %w", registration.ModuleID, registration.Set.Name, err)
			}
			setStatus := statusFor(registration, current)
			if setStatus.Compatible && registration.Completion != nil {
				if err := registration.Completion.Verify(operationCtx); err != nil {
					if errors.Is(err, ErrCompletionRequired) {
						setStatus.Compatible = false
					} else {
						return Status{}, fmt.Errorf("verify migration completion for module %q: %w", registration.ModuleID, err)
					}
				}
			}
			result.Sets = append(result.Sets, setStatus)
			result.Compatible = result.Compatible && setStatus.Compatible
		}
		return result, nil
	})
}

// Up 按 ModuleID 稳定顺序执行每个 set；任一失败即停止，已完成 set 不回滚。
func (s *Service) Up(ctx context.Context) (Status, error) {
	return s.withTimeout(ctx, func(operationCtx context.Context) (Status, error) {
		if err := s.preflight(operationCtx, s.database, s.catalog); err != nil {
			return Status{}, err
		}
		result := Status{Sets: make([]SetStatus, 0, len(s.catalog.registrations)), Compatible: true}
		for _, registration := range s.catalog.registrations {
			setStatus, err := s.upSet(operationCtx, registration)
			if err != nil {
				result.Compatible = false
				return result, err
			}
			result.Sets = append(result.Sets, setStatus)
			result.Compatible = result.Compatible && setStatus.Compatible
		}
		return result, nil
	})
}

func (s *Service) upSet(ctx context.Context, registration Registration) (result SetStatus, resultErr error) {
	runner, err := s.factory(ctx, dbmigrate.Config{Database: s.database, LockTimeout: s.config.LockTimeout}, registration.Set)
	if err != nil {
		return SetStatus{}, fmt.Errorf("create migration runner for module %q set %q: %w", registration.ModuleID, registration.Set.Name, err)
	}
	defer func() {
		if closeErr := runner.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close migration runner for module %q set %q: %w", registration.ModuleID, registration.Set.Name, closeErr))
		}
	}()
	if err := runner.Up(ctx); err != nil {
		return SetStatus{}, fmt.Errorf("apply migration for module %q set %q: %w", registration.ModuleID, registration.Set.Name, err)
	}
	if registration.Completion != nil {
		if err := registration.Completion.Resolve(ctx); err != nil {
			return SetStatus{}, fmt.Errorf("resolve migration completion for module %q: %w", registration.ModuleID, err)
		}
		if err := registration.Completion.Verify(ctx); err != nil {
			return SetStatus{}, fmt.Errorf("verify migration completion for module %q: %w", registration.ModuleID, err)
		}
	}
	current, err := runner.Status(ctx)
	if err != nil {
		return SetStatus{}, fmt.Errorf("read completed migration status for module %q: %w", registration.ModuleID, err)
	}
	result = statusFor(registration, current)
	if !result.Compatible {
		return result, fmt.Errorf("migration for module %q finished at incompatible version", registration.ModuleID)
	}
	return result, nil
}

func (s *Service) withTimeout(ctx context.Context, operation func(context.Context) (Status, error)) (Status, error) {
	if ctx == nil {
		return Status{}, fmt.Errorf("migration operation context is nil")
	}
	operationCtx, cancel := context.WithTimeout(ctx, s.config.OperationTimeout)
	defer cancel()
	return operation(operationCtx)
}

func statusFor(registration Registration, current dbmigrate.Status) SetStatus {
	result := SetStatus{
		ModuleID: string(registration.ModuleID), SetName: registration.Set.Name,
		Current: current.Version, Target: registration.Set.CurrentVersion,
		Dirty: current.Dirty, Empty: current.Empty,
	}
	result.Compatible = !result.Empty && !result.Dirty && result.Current == result.Target
	return result
}

// Compatible 执行 service startup 的只读全目录门禁。
func (s *Service) Compatible(ctx context.Context) error {
	status, err := s.Status(ctx)
	if err != nil {
		return err
	}
	for _, set := range status.Sets {
		switch {
		case set.Dirty:
			return fmt.Errorf("migration module %q is dirty at version %d", set.ModuleID, set.Current)
		case set.Empty || set.Current < set.Target:
			return fmt.Errorf("migration module %q version is too old: current %d target %d", set.ModuleID, set.Current, set.Target)
		case set.Current > set.Target:
			return fmt.Errorf("migration module %q version is too new: current %d target %d", set.ModuleID, set.Current, set.Target)
		case !set.Compatible:
			return ErrCompletionRequired
		}
	}
	return nil
}

// DefaultPreflight 拒绝任何已注册的退休 baseline 标记，且绝不自动修改用户数据库。
func DefaultPreflight(ctx context.Context, config database.Config, catalog Catalog) error {
	tables := make([]string, 0)
	owners := make(map[string]string)
	for _, registration := range catalog.registrations {
		for _, table := range registration.RetiredTables {
			tables = append(tables, table)
			owners[table] = string(registration.ModuleID)
		}
	}
	if len(tables) == 0 {
		return nil
	}
	sort.Strings(tables)
	presence, err := dbmigrate.ReadTablePresence(ctx, config, tables)
	if err != nil {
		return err
	}
	for _, table := range tables {
		if presence[table] {
			return fmt.Errorf("%w: module %q retired table %q exists", ErrPreReleaseBaselineResetRequired, owners[table], table)
		}
	}
	return nil
}

// NewDefaultFactory 返回生产 composition 使用的 golang-migrate Adapter 构造器。
func NewDefaultFactory(ctx context.Context, config dbmigrate.Config, set dbmigrate.Set) (Runner, error) {
	return dbmigrate.New(ctx, config, set)
}
