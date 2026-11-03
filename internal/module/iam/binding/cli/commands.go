// Package clibinding 绑定 IAM 管理命令。
package clibinding

import (
	"context"
	"fmt"
	kernelcli "github.com/reina0721/clouddrive/internal/kernel/cli"
	"github.com/reina0721/clouddrive/pkg/cli"
)

type Executor interface {
	ResetPassword(context.Context, string, string) error
}
type Contract struct{ executor Executor }

func New(executor Executor) (kernelcli.Contract, error) {
	if executor == nil {
		return nil, fmt.Errorf("iam CLI executor is nil")
	}
	return &Contract{executor: executor}, nil
}
func (c *Contract) Commands() ([]cli.CommandSpec, error) {
	return []cli.CommandSpec{{Name: "iam", Description: "管理本地 IAM 账号", Mode: cli.CommandModeApplication, SideEffect: cli.SideEffectExternalWrite, Positional: cli.PositionalNone, Commands: []cli.CommandSpec{c.resetPasswordCommand()}}}, nil
}
func (c *Contract) resetPasswordCommand() cli.CommandSpec {
	return cli.CommandSpec{Name: "reset-password", Description: "重置本地 IAM 账号密码", Mode: cli.CommandModeApplication, SideEffect: cli.SideEffectExternalWrite, Positional: cli.PositionalNone, Flags: []cli.FlagSpec{{Name: "username", Type: cli.FlagTypeString, Required: true, Description: "IAM 用户名"}, {Name: "password", Type: cli.FlagTypeString, Description: "新密码；未提供时通过安全输入提示读取"}}, Run: func(ctx *cli.Context) error {
		password := ctx.GetString("password")
		if password == "" {
			if ctx.UI == nil {
				return &cli.UsageError{Command: ctx.CommandPath, Message: "password is required when interactive input is unavailable"}
			}
			var err error
			password, err = ctx.UI.Password(ctx.Context, "请输入新密码")
			if err != nil {
				return fmt.Errorf("read iam password: %w", err)
			}
		}
		if err := c.executor.ResetPassword(ctx.Context, ctx.GetString("username"), password); err != nil {
			return err
		}
		_, err := fmt.Fprintln(ctx.Stdout, "iam password reset")
		return err
	}}
}

var _ kernelcli.Contract = (*Contract)(nil)
