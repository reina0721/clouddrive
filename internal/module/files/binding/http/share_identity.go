package httpbinding

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

func optionalShareIdentity(h *handler.Handler) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		request, writer := humabinding.UnwrapHTTP(ctx)
		request = request.WithContext(ctx.Context())
		authenticated, err := h.PublicAuthentication.AuthenticateOptional(request)
		if err != nil {
			httpx.WriteProblem(writer, request, h.Present(ctx.Context(), err))
			return
		}
		next(huma.WithContext(ctx, authenticated.Context()))
	}
}
