package httpbinding

import (
	"context"
	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"net/http"
)

type historyPreferencesOutput struct{ Body model.HistoryPreferences }
type historyPreferencesInput struct{ Body model.HistoryPreferences }

const maxPreferencesControlBytes int64 = 128 * 1024

type preferencesOutput struct{ Body model.FilePreferences }
type preferencesInput struct{ Body model.FilePreferences }

func registerPreferences(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	huma.Register(api, operation("files.preferences.history.read", http.MethodGet, "/preferences/history", "files:read", false), func(ctx context.Context, _ *struct{}) (*historyPreferencesOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Preferences.ReadHistory(ctx, owner)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &historyPreferencesOutput{Body: value}, nil
	})
	historySave := operation("files.preferences.history.save", http.MethodPut, "/preferences/history", "files:write", true)
	historySave.MaxBodyBytes = maxPreferencesControlBytes
	huma.Register(api, historySave, func(ctx context.Context, input *historyPreferencesInput) (*historyPreferencesOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Preferences.SaveHistory(ctx, owner, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.history-preferences.saved")
		return &historyPreferencesOutput{Body: value}, nil
	})
	huma.Register(api, operation("files.preferences.read", http.MethodGet, "/preferences", "files:read", false), func(ctx context.Context, _ *struct{}) (*preferencesOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Preferences.Read(ctx, owner)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &preferencesOutput{Body: value}, nil
	})
	op := operation("files.preferences.save", http.MethodPut, "/preferences", "files:write", true)
	op.MaxBodyBytes = maxPreferencesControlBytes
	huma.Register(api, op, func(ctx context.Context, input *preferencesInput) (*preferencesOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Preferences.Save(ctx, owner, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.preferences.saved")
		return &preferencesOutput{Body: value}, nil
	})
}
