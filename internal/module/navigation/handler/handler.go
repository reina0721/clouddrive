package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/reina0721/clouddrive/internal/module/navigation/model"
	"github.com/reina0721/clouddrive/internal/module/navigation/service"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

type Operations interface {
	ListMenus(context.Context) (MenuList, error)
	UpdateMenu(context.Context, UpdateMenuRequest) (Revision, error)
}
type Handler struct{ service *service.Service }

func New(navigationService *service.Service) (*Handler, error) {
	if navigationService == nil {
		return nil, fmt.Errorf("navigation HTTP service is nil")
	}
	return &Handler{service: navigationService}, nil
}
func (handler *Handler) ListMenus(ctx context.Context) (MenuList, error) {
	menus, snapshot, err := handler.service.MenuSnapshot(ctx)
	if err != nil {
		return MenuList{}, present(err)
	}
	items := make([]Menu, len(menus))
	for index, item := range menus {
		items[index] = Menu{Label: item.Label, Permission: item.PresentationPermission, ID: item.ID, ModuleID: item.ModuleID, RouteID: item.RouteID, TitleMessageID: item.TitleMessageID, IconID: item.IconID, DefaultParentID: item.DefaultParentID, DefaultOrder: int(item.DefaultOrder), Enabled: item.Enabled, ParentID: item.ParentID, Order: int(item.Order), Version: item.Version, Overridden: item.Overridden, ParentOverridden: item.ParentOverridden, OrderOverridden: item.OrderOverridden}
	}
	return MenuList{Items: items, CatalogRevision: snapshot.CatalogRevision, NavigationRevision: snapshot.NavigationRevision}, nil
}
func (handler *Handler) UpdateMenu(ctx context.Context, request UpdateMenuRequest) (Revision, error) {
	snapshot, err := handler.service.Update(ctx, service.UpdateCommand{Label: request.Label, PresentationPermission: request.Permission, NavigationID: request.ID, Enabled: request.Enabled, ParentOverride: request.ParentOverride, OrderOverride: request.OrderOverride, Version: request.Version})
	if err != nil {
		return Revision{}, present(err)
	}
	return Revision{CatalogRevision: snapshot.CatalogRevision, NavigationRevision: snapshot.NavigationRevision}, nil
}
func present(err error) error {
	status, code := http.StatusInternalServerError, "navigation_internal_error"
	switch {
	case errors.Is(err, model.ErrUnknown), errors.Is(err, model.ErrNotManageable):
		status, code = http.StatusNotFound, "navigation_unknown"
	case errors.Is(err, model.ErrInvalidOrder), errors.Is(err, model.ErrInvalidParent):
		status, code = http.StatusBadRequest, "navigation_invalid_argument"
	case errors.Is(err, model.ErrCycle), errors.Is(err, model.ErrCatalogChanged), errors.Is(err, model.ErrConflict):
		status, code = http.StatusConflict, "navigation_conflict"
	}
	return &httpx.StatusError{StatusCode: status, Code: code, Message: code, Err: err}
}

var _ Operations = (*Handler)(nil)
