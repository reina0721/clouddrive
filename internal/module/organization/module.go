// Package organization 负责部门、岗位与账号组织关系的局部装配。
package organization

import (
	"fmt"

	"github.com/reina0721/clouddrive/internal/module"
	organizationhandler "github.com/reina0721/clouddrive/internal/module/organization/handler"
	"github.com/reina0721/clouddrive/internal/module/organization/repo"
	"github.com/reina0721/clouddrive/internal/module/organization/service"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

const moduleID module.ID = "organization"

// Dependencies 是 Organization 实际使用的稳定能力。
type Dependencies struct {
	Database         repo.Access
	Clock            clock.Clock
	IDGenerator      idgen.Generator
	AccountDirectory service.AccountDirectory
}

// Module 是 Organization 局部装配结果。
type Module struct {
	Service      *service.Service
	Contribution module.Contribution
}

// HTTPModule 是 Organization HTTP profile 的完整输出。
type HTTPModule struct {
	Module
	Operations organizationhandler.Operations
}

// New 构造 Organization Service 与 contribution，不启动资源。
func New(dependencies Dependencies) (Module, error) {
	store, err := repo.New(dependencies.Database)
	if err != nil {
		return Module{}, fmt.Errorf("compose organization repository: %w", err)
	}
	organizationService, err := service.New(store, dependencies.Clock, dependencies.IDGenerator, dependencies.AccountDirectory)
	if err != nil {
		return Module{}, fmt.Errorf("compose organization service: %w", err)
	}
	contribution := module.Contribution{ID: moduleID}
	if err := module.ValidateContributions(contribution); err != nil {
		return Module{}, fmt.Errorf("validate organization contribution: %w", err)
	}
	return Module{Service: organizationService, Contribution: contribution}, nil
}

// NewHTTP 构造 Organization core 与模块顶层 typed handler。
func NewHTTP(dependencies Dependencies) (HTTPModule, error) {
	core, err := New(dependencies)
	if err != nil {
		return HTTPModule{}, err
	}
	handler, err := organizationhandler.New(core.Service)
	if err != nil {
		return HTTPModule{}, fmt.Errorf("compose organization HTTP handler: %w", err)
	}
	return HTTPModule{Module: core, Operations: handler}, nil
}
