package composition

import (
	"context"
	"fmt"

	"github.com/reina0721/clouddrive/internal/kernel"
	databaseapp "github.com/reina0721/clouddrive/internal/kernel/app/database"
	kernelcomposition "github.com/reina0721/clouddrive/internal/kernel/composition"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	"github.com/reina0721/clouddrive/internal/module/iam"
	iamconfig "github.com/reina0721/clouddrive/internal/module/iam/binding/config"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"github.com/reina0721/clouddrive/pkg/supervisor"
)

type iamExecutor struct{ application *Application }

func (e iamExecutor) ResetPassword(ctx context.Context, username, password string) error {
	return e.application.executeIAMResetPassword(ctx, username, password)
}

func (a *Application) executeIAMResetPassword(ctx context.Context, username, password string) error {
	if a == nil {
		return fmt.Errorf("application is nil")
	}
	loader := config.New(
		config.FileSource(a.config.ConfigPath),
		config.EnvSource(a.config.EnvironmentPrefix),
	)
	runtime, err := kernel.New(loader, kernel.Options{Logging: a.config.Logging})
	if err != nil {
		return fmt.Errorf("create kernel: %w", err)
	}
	capabilities, err := kernelcomposition.Compose(runtime, kernelcomposition.Options{
		Logger: kernelcomposition.ConfiguredLoggerReplacement,
	})
	if err != nil {
		return fmt.Errorf("compose application capabilities: %w", err)
	}
	bindings := append([]config.Binding{
		kernelcomposition.HTTPConfiguration(),
	}, applicationOwnedConfigurationBindings()...)
	coordinator, err := kernel.NewCoordinator(runtime, bindings...)
	if err != nil {
		return fmt.Errorf("create configuration coordinator: %w", err)
	}
	candidate, err := coordinator.Prepare(ctx)
	if err != nil {
		return fmt.Errorf("prepare application configuration: %w", err)
	}
	iamConfig, err := iamconfig.Decode(candidate)
	if err != nil {
		return err
	}
	databaseConfig, err := databaseapp.Decode(candidate)
	if err != nil {
		return err
	}
	databaseAccess, err := adaptDatabaseAccess(capabilities.Database)
	if err != nil {
		return err
	}
	migrationService, err := applicationMigrationService(candidate, databaseConfig.PackageConfig())
	if err != nil {
		return err
	}
	permissions := a.blueprint.permissions
	iamModule, err := iam.New(iam.Dependencies{
		Database: databaseAccess, Clock: capabilities.Clock, IDGenerator: idgen.UUID(), Config: iamConfig, Permissions: permissions,
	})
	if err != nil {
		return fmt.Errorf("compose local iam module: %w", err)
	}
	owner, err := newTodoOperationSupervisor([]supervisor.Participant{coordinator})
	if err != nil {
		return fmt.Errorf("create webui operation supervisor: %w", err)
	}
	if err := owner.RunOperation(ctx, func(operationCtx context.Context) error {
		if err := migrationService.Compatible(operationCtx); err != nil {
			return fmt.Errorf("verify application migration compatibility: %w", err)
		}
		if err := iamModule.Administration.ReconcileOwnerCatalog(operationCtx); err != nil {
			return fmt.Errorf("reconcile iam owner catalog: %w", err)
		}
		if err := iamModule.Administration.Compatible(operationCtx); err != nil {
			return fmt.Errorf("verify iam catalog compatibility: %w", err)
		}
		return iamModule.Administration.ResetPasswordByUsername(operationCtx, username, password)
	}); err != nil {
		return fmt.Errorf("execute webui password reset: %w", err)
	}
	return nil
}
