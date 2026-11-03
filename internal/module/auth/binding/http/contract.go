// Package httpbinding 通过项目 HTTP 边界发布 Auth 低敏审计查询能力。
package httpbinding

import (
	"errors"
	"net/http"
	"time"

	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	authservice "github.com/reina0721/clouddrive/internal/module/auth/service"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

const (
	// opAuditList 是审计只读查询的 operation ID。
	opAuditList = "auth.audit.list"
	// opAuditRead 是单个低敏审计详情的 operation ID。
	opAuditRead = "auth.audit.read"
)

// Handler 是 Auth 审计查询的 typed HTTP handler。
type Handler struct {
	service *authservice.Service
}

func NewHandler(authService *authservice.Service) (*Handler, error) {
	if authService == nil {
		return nil, errors.New("auth HTTP service is nil")
	}
	return &Handler{service: authService}, nil
}

// auditEventViewResponse 是低敏审计事件视图；subject/resource 只暴露摘要。
type auditEventViewResponse struct {
	EventID       uint64                   `json:"eventId"`
	CorrelationID string                   `json:"correlationId,omitempty"`
	Operation     string                   `json:"operation,omitempty"`
	Action        string                   `json:"action,omitempty"`
	ActorKind     string                   `json:"actorKind,omitempty"`
	SubjectHash   string                   `json:"subjectHash,omitempty"`
	ResourceType  string                   `json:"resourceType,omitempty"`
	ResourceHash  string                   `json:"resourceHash,omitempty"`
	Decision      authmodel.DecisionReason `json:"decision"`
	Outcome       authmodel.AuditOutcome   `json:"outcome"`
	OccurredAt    time.Time                `json:"occurredAt"`
}

type auditEventListResponse struct {
	Items      []auditEventViewResponse `json:"items"`
	Limit      int                      `json:"limit"`
	Total      int64                    `json:"total"`
	NextCursor string                   `json:"nextCursor,omitempty"`
	HasMore    bool                     `json:"hasMore"`
}

type auditListInput struct {
	Cursor        string `query:"cursor"`
	Limit         int    `query:"limit" minimum:"1" maximum:"100" default:"20"`
	CorrelationID string `query:"correlationId"`
	Operation     string `query:"operation"`
	Action        string `query:"action"`
	Outcome       string `query:"outcome"`
	ActorKind     string `query:"actorKind"`
	SubjectHash   string `query:"subjectHash"`
	ResourceType  string `query:"resourceType"`
	Since         string `query:"since"`
	Until         string `query:"until"`
}

type auditReadInput struct {
	EventID uint64 `path:"eventId" minimum:"1"`
}

func serviceError(err error) error {
	if errors.Is(err, authservice.ErrAuditEventNotFound) {
		return &httpx.StatusError{StatusCode: http.StatusNotFound, Code: "not_found", Message: "not_found", Err: err}
	}
	if errors.Is(err, authservice.ErrAuditCursorInvalid) {
		return &httpx.StatusError{StatusCode: http.StatusBadRequest, Code: "invalid_cursor", Message: "invalid_cursor", Err: err}
	}
	return &httpx.StatusError{StatusCode: http.StatusInternalServerError, Code: "internal_server_error", Message: "internal_server_error", Err: err}
}

func parseOptionalTime(value string) (*time.Time, error) {
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil, httpx.NewProtocolProblemError(nil, &httpx.StatusError{StatusCode: http.StatusBadRequest, Code: "invalid_argument", Message: "invalid_argument", Err: err})
	}
	return &parsed, nil
}

func (handler *Handler) queryFilter(input *auditListInput) (authservice.AuditQueryFilter, error) {
	var filter authservice.AuditQueryFilter
	filter.CorrelationID = input.CorrelationID
	filter.Operation = input.Operation
	filter.Action = input.Action
	filter.Outcome = input.Outcome
	filter.ActorKind = input.ActorKind
	filter.SubjectHash = input.SubjectHash
	filter.ResourceType = input.ResourceType
	since, err := parseOptionalTime(input.Since)
	if err != nil {
		return authservice.AuditQueryFilter{}, err
	}
	until, err := parseOptionalTime(input.Until)
	if err != nil {
		return authservice.AuditQueryFilter{}, err
	}
	filter.Since = since
	filter.Until = until
	return filter, nil
}
