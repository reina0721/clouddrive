package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type inventoryListInput struct {
	OwnerID       string                     `query:"ownerId" maxLength:"128"`
	Name          string                     `query:"name" maxLength:"255"`
	Kind          model.Kind                 `query:"kind" enum:"file,folder,shortcut"`
	Trash         service.InventoryTrash     `query:"trash" enum:"any,direct,unmarked" default:"any"`
	HasShare      bool                       `query:"hasShare"`
	HasDirectLink bool                       `query:"hasDirectLink"`
	Sort          service.InventorySort      `query:"sort" enum:"id,name,size,created" default:"created"`
	Direction     service.InventoryDirection `query:"direction" enum:"asc,desc" default:"desc"`
	Page          int                        `query:"page" minimum:"1" maximum:"10000" default:"1"`
}
type inventoryDetailInput struct {
	ID string `path:"id" minLength:"36" maxLength:"36"`
}
type inventoryListOutput struct{ Body service.InventoryPage }
type inventoryDetailOutput struct{ Body service.InventoryItem }

func registerInventory(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	inventoryOperation := func(id, suffix string) huma.Operation {
		op := operation(id, http.MethodGet, "/inventory"+suffix, string(permission.InventoryRead), false)
		op.Middlewares = append(op.Middlewares, sharingHeaders)
		return op
	}
	huma.Register(api, inventoryOperation("files.inventory.list", ""), func(ctx context.Context, input *inventoryListInput) (*inventoryListOutput, error) {
		page, err := h.Inventory.List(ctx, service.InventoryQuery{
			OwnerID: input.OwnerID, Name: input.Name, Kind: input.Kind, Trash: input.Trash, HasShare: input.HasShare,
			HasDirectLink: input.HasDirectLink, Sort: input.Sort, Direction: input.Direction, Page: input.Page,
		})
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.inventory.listed")
		return &inventoryListOutput{Body: page}, nil
	})
	huma.Register(api, inventoryOperation("files.inventory.detail", "/{id}"), func(ctx context.Context, input *inventoryDetailInput) (*inventoryDetailOutput, error) {
		item, err := h.Inventory.Read(ctx, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.inventory.detail.read")
		return &inventoryDetailOutput{Body: item}, nil
	})
}
