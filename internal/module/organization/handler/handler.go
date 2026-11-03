package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/reina0721/clouddrive/internal/module/organization/model"
	"github.com/reina0721/clouddrive/internal/module/organization/repo"
	"github.com/reina0721/clouddrive/internal/module/organization/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

type Operations interface {
	ListDepartments(context.Context, ListParams) (DepartmentList, error)
	DepartmentTree(context.Context, TreeParams) ([]DepartmentNode, error)
	CreateDepartment(context.Context, CreateDepartmentRequest) (Department, error)
	UpdateDepartment(context.Context, UpdateDepartmentRequest) (Department, error)
	ListPositions(context.Context, ListParams) (PositionList, error)
	CreatePosition(context.Context, CreatePositionRequest) (Position, error)
	UpdatePosition(context.Context, UpdatePositionRequest) (Position, error)
	GetAssignment(context.Context, string) (Assignment, error)
	ReplaceAssignment(context.Context, ReplaceAssignmentRequest) (Assignment, error)
}

type Handler struct{ service *service.Service }

func New(organizationService *service.Service) (*Handler, error) {
	if organizationService == nil {
		return nil, fmt.Errorf("organization HTTP service is nil")
	}
	return &Handler{service: organizationService}, nil
}

func (h *Handler) ListDepartments(ctx context.Context, params ListParams) (DepartmentList, error) {
	offset, limit, activeOnly, query := listValues(params)
	result, err := h.service.ListDepartments(ctx, offset, limit, activeOnly, query)
	if err != nil {
		return DepartmentList{}, present(err)
	}
	items := make([]Department, len(result.Items))
	for index, item := range result.Items {
		items[index] = departmentDTO(item)
	}
	return DepartmentList{Items: items, Offset: result.Offset, Limit: result.Limit, Total: result.Total}, nil
}

func (h *Handler) DepartmentTree(ctx context.Context, params TreeParams) ([]DepartmentNode, error) {
	activeOnly := false
	if params.ActiveOnly != nil {
		activeOnly = *params.ActiveOnly
	}
	result, err := h.service.DepartmentTree(ctx, activeOnly)
	if err != nil {
		return nil, present(err)
	}
	return treeDTO(result), nil
}

func (h *Handler) CreateDepartment(ctx context.Context, request CreateDepartmentRequest) (Department, error) {
	result, err := h.service.CreateDepartment(ctx, request.Code, request.Name, request.ParentID, service.DepartmentDetails{Leader: request.Leader, Remark: request.Remark})
	if err != nil {
		return Department{}, present(err)
	}
	return departmentDTO(result), nil
}

func (h *Handler) UpdateDepartment(ctx context.Context, request UpdateDepartmentRequest) (Department, error) {
	var parent **string
	if request.ClearParent {
		var empty *string
		parent = &empty
	} else if request.ParentID != nil {
		value := request.ParentID
		parent = &value
	}
	result, err := h.service.UpdateDepartment(ctx, service.UpdateDepartmentCommand{Leader: request.Leader, Remark: request.Remark, ID: request.ID, Version: request.Version, Name: request.Name, ParentID: parent, Active: request.Active, Archived: request.Archived})
	if err != nil {
		return Department{}, present(err)
	}
	return departmentDTO(result), nil
}

func (h *Handler) ListPositions(ctx context.Context, params ListParams) (PositionList, error) {
	offset, limit, activeOnly, query := listValues(params)
	result, err := h.service.ListPositions(ctx, offset, limit, activeOnly, query)
	if err != nil {
		return PositionList{}, present(err)
	}
	items := make([]Position, len(result.Items))
	for index, item := range result.Items {
		items[index] = positionDTO(item)
	}
	return PositionList{Items: items, Offset: result.Offset, Limit: result.Limit, Total: result.Total}, nil
}

func (h *Handler) CreatePosition(ctx context.Context, request CreatePositionRequest) (Position, error) {
	result, err := h.service.CreatePosition(ctx, request.Code, request.Name)
	if err != nil {
		return Position{}, present(err)
	}
	return positionDTO(result), nil
}

func (h *Handler) UpdatePosition(ctx context.Context, request UpdatePositionRequest) (Position, error) {
	result, err := h.service.UpdatePosition(ctx, service.UpdatePositionCommand{ID: request.ID, Version: request.Version, Name: request.Name, Active: request.Active, Archived: request.Archived})
	if err != nil {
		return Position{}, present(err)
	}
	return positionDTO(result), nil
}

func (h *Handler) GetAssignment(ctx context.Context, accountID string) (Assignment, error) {
	result, err := h.service.Assignment(ctx, accountID)
	if err != nil {
		return Assignment{}, present(err)
	}
	return assignmentDTO(result), nil
}

func (h *Handler) ReplaceAssignment(ctx context.Context, request ReplaceAssignmentRequest) (Assignment, error) {
	result, err := h.service.ReplaceAssignment(ctx, request.AccountID, request.ExpectedVersion, request.DepartmentID, request.PositionIDs)
	if err != nil {
		return Assignment{}, present(err)
	}
	return assignmentDTO(result), nil
}

func present(err error) error {
	status, code := http.StatusInternalServerError, "organization_internal_error"
	switch {
	case errors.Is(err, model.ErrInvalidID), errors.Is(err, model.ErrInvalidCode), errors.Is(err, model.ErrInvalidName), errors.Is(err, model.ErrInvalidTime), errors.Is(err, model.ErrInvalidQuery):
		status, code = http.StatusBadRequest, "organization_invalid_argument"
	case errors.Is(err, repo.ErrNotFound), errors.Is(err, database.ErrNotFound):
		status, code = http.StatusNotFound, "organization_not_found"
	case errors.Is(err, model.ErrCycle), errors.Is(err, model.ErrDepthExceeded), errors.Is(err, model.ErrReferenced), errors.Is(err, model.ErrAccountInvalid), errors.Is(err, database.ErrDuplicateKey), errors.Is(err, database.ErrOptimisticConflict):
		status, code = http.StatusConflict, "organization_conflict"
	}
	return &httpx.StatusError{StatusCode: status, Code: code, Message: code, Err: err}
}

func listValues(params ListParams) (int, int, bool, string) {
	offset, limit, activeOnly, query := 0, 0, false, ""
	if params.Offset != nil {
		offset = *params.Offset
	}
	if params.Limit != nil {
		limit = *params.Limit
	}
	if params.ActiveOnly != nil {
		activeOnly = *params.ActiveOnly
	}
	if params.Query != nil {
		query = *params.Query
	}
	return offset, limit, activeOnly, query
}
func departmentDTO(value model.Department) Department {
	return Department{Leader: value.Leader, Remark: value.Remark, MemberCount: value.MemberCount, ID: value.ID, Code: value.Code, Name: value.Name, ParentID: value.ParentID, Active: value.Active, Archived: value.Archived, Version: value.Version, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt}
}
func positionDTO(value model.Position) Position {
	return Position{ID: value.ID, Code: value.Code, Name: value.Name, Active: value.Active, Archived: value.Archived, Version: value.Version, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt}
}
func assignmentDTO(value model.Assignment) Assignment {
	return Assignment{AccountID: value.AccountID, DepartmentID: value.DepartmentID, PositionIDs: value.PositionIDs, Version: value.Version}
}
func treeDTO(values []service.DepartmentNode) []DepartmentNode {
	result := make([]DepartmentNode, len(values))
	for index, value := range values {
		result[index] = DepartmentNode{Department: departmentDTO(value.Department), Children: treeDTO(value.Children)}
	}
	return result
}

var _ Operations = (*Handler)(nil)
