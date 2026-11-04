package composition

import (
	"context"
	"errors"
	"fmt"

	databaseapp "github.com/reina0721/clouddrive/internal/kernel/app/database"
	kernelcomposition "github.com/reina0721/clouddrive/internal/kernel/composition"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	authmigration "github.com/reina0721/clouddrive/internal/module/auth/binding/migration"
	consolemigration "github.com/reina0721/clouddrive/internal/module/console/binding/migration"
	filesmigration "github.com/reina0721/clouddrive/internal/module/files/binding/migration"
	iammigration "github.com/reina0721/clouddrive/internal/module/iam/binding/migration"
	"github.com/reina0721/clouddrive/internal/module/migration"
	migrationconfig "github.com/reina0721/clouddrive/internal/module/migration/binding/config"
	navigationmigration "github.com/reina0721/clouddrive/internal/module/navigation/binding/migration"
	organizationmigration "github.com/reina0721/clouddrive/internal/module/organization/binding/migration"
	todomigration "github.com/reina0721/clouddrive/internal/module/todo/binding/migration"
	pkgdatabase "github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/logger"
)

type migrationExecutor struct{ application *Application }

func (e migrationExecutor) MigrationStatus(ctx context.Context) (migration.Status, error) {
	return e.application.executeMigration(ctx, "db.migrate.status", func(ctx context.Context, service *migration.Service) (migration.Status, error) {
		return service.Status(ctx)
	})
}

func (e migrationExecutor) MigrationUp(ctx context.Context) (migration.Status, error) {
	return e.application.executeMigration(ctx, "db.migrate.up", func(ctx context.Context, service *migration.Service) (migration.Status, error) {
		return service.Up(ctx)
	})
}

// applicationMigrationCatalog 是当前应用中“哪些模块贡献 migration set”的唯一显式汇总点。
func applicationMigrationCatalog() (migration.Catalog, error) {
	return migration.BuildCatalog(
		migration.Registration{ModuleID: "files", Source: "internal/module/files/binding/migration", Set: filesmigration.Set()},
		migration.Registration{ModuleID: "console", Source: "internal/module/console/binding/migration", Set: consolemigration.Set()},
		migration.Registration{ModuleID: "auth", Source: "internal/module/auth/binding/migration", Set: authmigration.Set()},
		migration.Registration{ModuleID: "iam", Source: "internal/module/iam/binding/migration", Set: iammigration.Set()},
		migration.Registration{ModuleID: "organization", Source: "internal/module/organization/binding/migration", Set: organizationmigration.Set()},
		migration.Registration{ModuleID: "navigation", Source: "internal/module/navigation/binding/migration", Set: navigationmigration.Set()},
		migration.Registration{
			ModuleID: "todo",
			Source:   "internal/module/todo/binding/migration",
			Set:      todomigration.Set(),
			RetiredTables: []string{
				"schema_migrations",
				"webui_sessions",
				"webui_users",
			},
		},
	)
}

func applicationMigrationService(snapshot config.Snapshot, databaseConfig pkgdatabase.Config) (*migration.Service, error) {
	moduleConfig, err := migrationconfig.Decode(snapshot)
	if err != nil {
		return nil, err
	}
	catalog, err := applicationMigrationCatalog()
	if err != nil {
		return nil, err
	}
	module, err := migration.NewModule(databaseConfig, moduleConfig, catalog, migration.NewDefaultFactory, migration.DefaultPreflight)
	if err != nil {
		return nil, err
	}
	return module.Service, nil
}

func (a *Application) executeMigration(
	ctx context.Context,
	operationName string,
	operation func(context.Context, *migration.Service) (migration.Status, error),
) (migration.Status, error) {
	if ctx == nil {
		return migration.Status{}, fmt.Errorf("migration application context is nil")
	}
	if operationName == "" {
		return migration.Status{}, fmt.Errorf("migration application operation name is empty")
	}
	if operation == nil {
		return migration.Status{}, fmt.Errorf("migration application operation is nil")
	}
	logging := a.config.Logging.Logger()
	logMigrationStarted(logging, operationName)
	bindings, err := kernelcomposition.ConfigurationBindings(applicationOwnedConfigurationBindings()...)
	if err != nil {
		logMigrationFailed(logging, operationName, "compose-config", err)
		return migration.Status{}, fmt.Errorf("compose migration configuration bindings: %w", err)
	}
	loader := config.New(
		config.FileSource(a.config.ConfigPath),
		config.EnvSource(a.config.EnvironmentPrefix),
	)
	snapshot, err := loader.Load(ctx)
	if err != nil {
		logMigrationFailed(logging, operationName, "load-config", err)
		return migration.Status{}, fmt.Errorf("load migration configuration: %w", err)
	}
	if err := config.ValidateCandidate(snapshot, bindings...); err != nil {
		logMigrationFailed(logging, operationName, "validate-config", err)
		return migration.Status{}, fmt.Errorf("validate migration configuration: %w", err)
	}
	databaseConfig, err := databaseapp.Decode(snapshot)
	if err != nil {
		logMigrationFailed(logging, operationName, "decode-database", err)
		return migration.Status{}, fmt.Errorf("decode migration database configuration: %w", err)
	}
	service, err := applicationMigrationService(snapshot, databaseConfig.PackageConfig())
	if err != nil {
		logMigrationFailed(logging, operationName, "compose-service", err)
		return migration.Status{}, err
	}
	status, err := operation(ctx, service)
	if err != nil {
		logMigrationFailed(logging, operationName, "run", err)
		return status, err
	}
	logMigrationCompleted(logging, operationName, status)
	return status, nil
}

func logMigrationStarted(logging logger.Logger, operation string) {
	if logging == nil {
		return
	}
	logging.Debug("migration operation started",
		logger.String("owner", "migration"),
		logger.String("phase", "start"),
		logger.String("operation", operation),
	)
}

func logMigrationCompleted(logging logger.Logger, operation string, status migration.Status) {
	if logging == nil {
		return
	}
	fields := []logger.Field{
		logger.String("owner", "migration"),
		logger.String("phase", "completed"),
		logger.String("operation", operation),
		logger.Any("set_count", len(status.Sets)),
		logger.Bool("compatible", status.Compatible),
	}
	if !status.Compatible {
		logging.Warn("migration operation completed with action required", fields...)
		return
	}
	logging.Info("migration operation completed", fields...)
}

func logMigrationFailed(logging logger.Logger, operation string, phase string, err error) {
	if logging == nil || err == nil {
		return
	}
	logging.Error("migration operation failed",
		logger.String("owner", "migration"),
		logger.String("phase", phase),
		logger.String("operation", operation),
		logger.String("error_type", migrationErrorType(err)),
		logger.String("cause_type", fmt.Sprintf("%T", err)),
	)
}

func migrationErrorType(err error) string {
	switch {
	case err == nil:
		return ""
	case errors.Is(err, context.Canceled):
		return "context_canceled"
	case errors.Is(err, context.DeadlineExceeded):
		return "context_deadline_exceeded"
	case errors.Is(err, migration.ErrCompletionRequired):
		return "migration_completion_required"
	case errors.Is(err, migration.ErrPreReleaseBaselineResetRequired):
		return "migration_baseline_reset_required"
	default:
		return fmt.Sprintf("%T", err)
	}
}
