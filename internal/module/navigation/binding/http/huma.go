package httpbinding

import (
	"context"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	navigationhandler "github.com/reina0721/clouddrive/internal/module/navigation/handler"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

type MutationGuard interface{ ValidateMutation(*http.Request) error }

// MutationGuard 保留 Navigation 所属的 Origin/Session/CSRF mutation 语义。
type navigationEmptyInput struct{}
type navigationUpdateInput struct {
	ID        string `path:"id" minLength:"1"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      navigationhandler.UpdateMenuRequest
}
type navigationListOutput struct{ Body navigationhandler.MenuList }
type navigationRevisionOutput struct{ Body navigationhandler.Revision }

// Register 注册 Navigation 的全部 typed HTTP operation。
func Register(api huma.API, operations navigationhandler.Operations, guard MutationGuard) {
	list := humabinding.Define(huma.Operation{OperationID: "navigation.menus.list", Method: http.MethodGet, Path: "/api/v1/navigation/menus", Tags: []string{"Navigation"}}, humabinding.Definition{Security: humabinding.SecurityWebUISession, Policy: humabinding.PolicyProtected, Scope: "navigation:menu:read", Action: "navigation.menu.list"})
	huma.Register(api, list, func(ctx context.Context, _ *navigationEmptyInput) (*navigationListOutput, error) {
		value, err := operations.ListMenus(ctx)
		if err != nil {
			return nil, httpx.NewProtocolProblemError(ctx, err)
		}
		return &navigationListOutput{Body: value}, nil
	})
	update := humabinding.JSONDefinition(huma.Operation{OperationID: "navigation.menus.update", Method: http.MethodPut, Path: "/api/v1/navigation/menus/{id}", Tags: []string{"Navigation"}, Middlewares: huma.Middlewares{mutationMiddleware(guard)}}, humabinding.Definition{Security: humabinding.SecurityWebUISession, Policy: humabinding.PolicyProtected, Scope: "navigation:menu:write", Action: "navigation.menu.update"})
	huma.Register(api, update, func(ctx context.Context, input *navigationUpdateInput) (*navigationRevisionOutput, error) {
		input.Body.ID = input.ID
		value, err := operations.UpdateMenu(ctx, input.Body)
		if err != nil {
			return nil, httpx.NewProtocolProblemError(ctx, err)
		}
		return &navigationRevisionOutput{Body: value}, nil
	})
}

func HumaRegistration(operations navigationhandler.Operations, guard MutationGuard) humabinding.Registration {
	return func(api huma.API) { Register(api, operations, guard) }
}

func mutationMiddleware(guard MutationGuard) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		request, writer := humabinding.UnwrapHTTP(ctx)
		if guard == nil {
			httpx.WriteProblem(writer, request, fmt.Errorf("navigation mutation guard is nil"))
			return
		}
		if err := guard.ValidateMutation(request); err != nil {
			httpx.WriteProblem(writer, request, err)
			return
		}
		next(ctx)
	}
}
