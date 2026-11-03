// Package clibinding 绑定显式 db migration status/up 命令。
package clibinding

import (
	"context"
	"encoding/json"
	"fmt"

	kernelcli "github.com/reina0721/clouddrive/internal/kernel/cli"
	"github.com/reina0721/clouddrive/internal/module/migration"
	"github.com/reina0721/clouddrive/pkg/cli"
)

// Executor 把命令解析结果交给 invocation-scoped composition。
type Executor interface {
	MigrationStatus(context.Context) (migration.Status, error)
	MigrationUp(context.Context) (migration.Status, error)
}

// Contract 只声明命令树，不创建数据库连接。
type Contract struct{ executor Executor }

// New 构造 Migration CLI contract。
func New(executor Executor) (*Contract, error) {
	if executor == nil {
		return nil, fmt.Errorf("migration CLI executor is nil")
	}
	return &Contract{executor: executor}, nil
}

// Commands 返回显式、无 down/repair 的 migration 命令。
func (c *Contract) Commands() ([]cli.CommandSpec, error) {
	return []cli.CommandSpec{{
		Name: "db", Description: "管理数据库", Mode: cli.CommandModeApplication,
		SideEffect: cli.SideEffectNone, Positional: cli.PositionalNone,
		Commands: []cli.CommandSpec{{
			Name: "migrate", Description: "管理 versioned migration", Mode: cli.CommandModeApplication,
			SideEffect: cli.SideEffectNone, Positional: cli.PositionalNone,
			Commands: []cli.CommandSpec{
				{Name: "status", Description: "读取 migration 版本", Mode: cli.CommandModeApplication, SideEffect: cli.SideEffectNone, Positional: cli.PositionalNone, Run: c.status},
				{Name: "up", Description: "应用全部待执行 migration", Mode: cli.CommandModeApplication, SideEffect: cli.SideEffectExternalWrite, Positional: cli.PositionalNone, Run: c.up},
			},
		}},
	}}, nil
}

func (c *Contract) status(ctx *cli.Context) error {
	status, err := c.executor.MigrationStatus(ctx.Context)
	return writeStatus(ctx, status, err)
}

func (c *Contract) up(ctx *cli.Context) error {
	status, err := c.executor.MigrationUp(ctx.Context)
	return writeStatus(ctx, status, err)
}

func writeStatus(ctx *cli.Context, status migration.Status, err error) error {
	if err != nil {
		return err
	}
	encoder := json.NewEncoder(ctx.Stdout)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(status); err != nil {
		return fmt.Errorf("encode migration CLI output: %w", err)
	}
	return nil
}

var _ kernelcli.Contract = (*Contract)(nil)
