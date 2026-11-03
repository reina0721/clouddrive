// Package navigation 负责静态菜单定义之上的运行时策略装配。
package navigation

import (
	"fmt"

	"github.com/reina0721/clouddrive/internal/module"
	navigationhandler "github.com/reina0721/clouddrive/internal/module/navigation/handler"
	"github.com/reina0721/clouddrive/internal/module/navigation/repo"
	"github.com/reina0721/clouddrive/internal/module/navigation/service"
	"github.com/reina0721/clouddrive/pkg/clock"
)

const moduleID module.ID = "navigation"

type Dependencies struct {
	Database repo.Access
	Clock    clock.Clock
	Catalog  service.NavigationCatalog
}
type Module struct {
	Service      *service.Service
	Contribution module.Contribution
}
type HTTPModule struct {
	Module
	Operations navigationhandler.Operations
}

func New(dependencies Dependencies) (Module, error) {
	store, err := repo.New(dependencies.Database)
	if err != nil {
		return Module{}, fmt.Errorf("compose navigation repository: %w", err)
	}
	navigationService, err := service.New(store, dependencies.Clock, dependencies.Catalog)
	if err != nil {
		return Module{}, fmt.Errorf("compose navigation service: %w", err)
	}
	contribution := module.Contribution{ID: moduleID}
	if err := module.ValidateContributions(contribution); err != nil {
		return Module{}, err
	}
	return Module{Service: navigationService, Contribution: contribution}, nil
}
func NewHTTP(dependencies Dependencies) (HTTPModule, error) {
	core, err := New(dependencies)
	if err != nil {
		return HTTPModule{}, err
	}
	handler, err := navigationhandler.New(core.Service)
	if err != nil {
		return HTTPModule{}, err
	}
	return HTTPModule{Module: core, Operations: handler}, nil
}
