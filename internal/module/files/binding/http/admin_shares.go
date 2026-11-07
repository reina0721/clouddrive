package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type adminShareListInput struct {
	OwnerID   string                     `query:"ownerId" maxLength:"128"`
	RootID    string                     `query:"rootId" maxLength:"36"`
	Status    service.ShareStatus        `query:"status" enum:"active,paused,expired,revoked"`
	Sort      service.AdminShareSort     `query:"sort" enum:"id,created,views,downloads" default:"created"`
	Direction service.InventoryDirection `query:"direction" enum:"asc,desc" default:"desc"`
	Page      int                        `query:"page" minimum:"1" maximum:"10000" default:"1"`
}

type adminShareListOutput struct {
	Body struct {
		service.AdminSharePage
		CanRevoke bool `json:"canRevoke"`
	}
}

type adminShareReadInput struct {
	ID string `path:"id" minLength:"36" maxLength:"36"`
}

type adminShareReadOutput struct{ Body service.AdminShareItem }

type adminShareRevokeInput struct {
	Body struct {
		Targets []service.AdminShareTarget `json:"targets" minItems:"1" maxItems:"20"`
	}
}

type adminShareRevokeOutput struct {
	Body struct {
		Revoked int `json:"revoked"`
	}
}

func registerAdminShares(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	const prefix = "/admin-shares"
	list := operation("files.admin-shares.list", http.MethodGet, prefix, string(permission.AdminShareRead), false)
	list.Middlewares = append(list.Middlewares, sharingHeaders)
	huma.Register(api, list, func(ctx context.Context, input *adminShareListInput) (*adminShareListOutput, error) {
		actor, err := h.Owner(ctx)
		if err != nil {
			return nil, err
		}
		allowed, err := h.AdminShareAccess.AuthorizeAdminShareRevoke(ctx, actor)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		page, err := h.AdminShares.List(ctx, service.AdminShareQuery{
			OwnerID: input.OwnerID, RootID: input.RootID, Status: input.Status, Sort: input.Sort, Direction: input.Direction, Page: input.Page,
		})
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		output := &adminShareListOutput{}
		output.Body.AdminSharePage, output.Body.CanRevoke = page, allowed
		return output, nil
	})
	read := operation("files.admin-shares.read", http.MethodGet, prefix+"/{id}", string(permission.AdminShareRead), false)
	read.Middlewares = append(read.Middlewares, sharingHeaders)
	huma.Register(api, read, func(ctx context.Context, input *adminShareReadInput) (*adminShareReadOutput, error) {
		item, err := h.AdminShares.Read(ctx, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &adminShareReadOutput{Body: item}, nil
	})
	revoke := operation("files.admin-shares.revoke", http.MethodPost, prefix+"/revoke", string(permission.AdminShareRevoke), true)
	revoke.Middlewares = append(revoke.Middlewares, sharingHeaders)
	huma.Register(api, revoke, func(ctx context.Context, input *adminShareRevokeInput) (*adminShareRevokeOutput, error) {
		count, err := h.AdminShares.Revoke(ctx, input.Body.Targets)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.admin-shares.revoked")
		output := &adminShareRevokeOutput{}
		output.Body.Revoked = count
		return output, nil
	})
}
