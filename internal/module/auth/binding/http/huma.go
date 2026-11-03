package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	authservice "github.com/reina0721/clouddrive/internal/module/auth/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

// auditListOutput 是审计查询的 HTTP 响应 envelope。
type auditListOutput struct {
	CacheControl string `header:"Cache-Control"`
	Body         auditEventListResponse
}

type auditDetailOutput struct {
	CacheControl string `header:"Cache-Control"`
	Body         auditEventViewResponse
}

func auditEventResponse(item authservice.AuditEventView) auditEventViewResponse {
	return auditEventViewResponse{
		EventID: item.EventID, CorrelationID: item.CorrelationID,
		Operation: item.Operation, Action: string(item.Action), ActorKind: string(item.ActorKind),
		SubjectHash: item.SubjectHash, ResourceType: item.ResourceType, ResourceHash: item.ResourceHash,
		Decision: item.Decision, Outcome: item.Outcome, OccurredAt: item.OccurredAt,
	}
}

// RegisterHuma 注册 Auth 低敏审计查询的 typed HTTP 契约。
func RegisterHuma(api huma.API, handler *Handler) {
	operation := humabinding.Define(huma.Operation{
		OperationID: opAuditList, Method: http.MethodGet, Path: "/api/v1/auth/audit",
		Tags: []string{"Auth"},
	}, humabinding.Definition{
		ID: opAuditList, Method: http.MethodGet, Path: "/api/v1/auth/audit",
		Security: humabinding.SecurityWebUISession, Policy: humabinding.PolicyProtected,
		Scope: string(authmodel.ScopeAuditRead), Action: "list",
	})
	huma.Register(api, operation, func(ctx context.Context, in *auditListInput) (*auditListOutput, error) {
		filter, err := handler.queryFilter(in)
		if err != nil {
			return nil, httpx.NewProtocolProblemError(ctx, err)
		}
		var cursor *authservice.AuditCursor
		if in.Cursor != "" {
			decoded, err := authservice.DecodeAuditCursor(in.Cursor)
			if err != nil {
				return nil, httpx.NewProtocolProblemError(ctx, serviceError(err))
			}
			cursor = &decoded
		}
		result, err := handler.service.ListAuditEvents(ctx, filter, cursor, in.Limit)
		if err != nil {
			return nil, httpx.NewProtocolProblemError(ctx, serviceError(err))
		}
		items := make([]auditEventViewResponse, len(result.Items))
		for index, item := range result.Items {
			items[index] = auditEventResponse(item)
		}
		return &auditListOutput{
			CacheControl: "no-store",
			Body:         auditEventListResponse{Items: items, Limit: result.Limit, Total: result.Total, NextCursor: result.NextCursor, HasMore: result.HasMore},
		}, nil
	})

	detail := humabinding.Define(huma.Operation{
		OperationID: opAuditRead, Method: http.MethodGet, Path: "/api/v1/auth/audit/{eventId}", Tags: []string{"Auth"},
	}, humabinding.Definition{
		ID: opAuditRead, Method: http.MethodGet, Path: "/api/v1/auth/audit/{eventId}",
		Security: humabinding.SecurityWebUISession, Policy: humabinding.PolicyProtected,
		Scope: string(authmodel.ScopeAuditRead), Action: "read",
	})
	huma.Register(api, detail, func(ctx context.Context, in *auditReadInput) (*auditDetailOutput, error) {
		item, err := handler.service.AuditEvent(ctx, in.EventID)
		if err != nil {
			return nil, httpx.NewProtocolProblemError(ctx, serviceError(err))
		}
		return &auditDetailOutput{CacheControl: "no-store", Body: auditEventResponse(item)}, nil
	})
}

func HumaRegistration(handler *Handler) humabinding.Registration {
	return func(api huma.API) { RegisterHuma(api, handler) }
}
