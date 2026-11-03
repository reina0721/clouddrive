package httpbinding

import (
	"context"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	organizationhandler "github.com/reina0721/clouddrive/internal/module/organization/handler"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

// MutationGuard 是 Organization 的 mutation operation 使用的 Origin/Session/CSRF
// 校验能力；由 composition 注入 IAM 的 iamMutationGuardAdapter（形状与
// Navigation 模块的 MutationGuard 一致，各模块持有自有窄接口，不跨模块 import）。
type MutationGuard interface{ ValidateMutation(*http.Request) error }

type organizationListInput struct {
	Offset     humabinding.Optional[int]    `query:"offset" minimum:"0"`
	Limit      humabinding.Optional[int]    `query:"limit" minimum:"1" maximum:"100"`
	ActiveOnly humabinding.Optional[bool]   `query:"activeOnly"`
	Query      humabinding.Optional[string] `query:"query" maxLength:"128"`
}
type organizationTreeInput struct {
	ActiveOnly humabinding.Optional[bool] `query:"activeOnly"`
}
type organizationPathInput struct {
	ID string `path:"id" minLength:"1" maxLength:"36"`
}
type createDepartmentInput struct {
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      organizationhandler.CreateDepartmentRequest
}
type updateDepartmentInput struct {
	ID        string `path:"id" minLength:"1" maxLength:"36"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      organizationhandler.UpdateDepartmentRequest
}
type createPositionInput struct {
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      organizationhandler.CreatePositionRequest
}
type updatePositionInput struct {
	ID        string `path:"id" minLength:"1" maxLength:"36"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      organizationhandler.UpdatePositionRequest
}
type replaceAssignmentInput struct {
	ID        string `path:"id" minLength:"1" maxLength:"36"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      organizationhandler.ReplaceAssignmentRequest
}
type departmentOutput struct {
	Body organizationhandler.Department
}
type departmentListOutput struct {
	Body organizationhandler.DepartmentList
}
type departmentTreeOutput struct {
	Body []organizationhandler.DepartmentNode
}
type positionOutput struct{ Body organizationhandler.Position }
type positionListOutput struct {
	Body organizationhandler.PositionList
}
type assignmentOutput struct {
	Body organizationhandler.Assignment
}

// Register 注册 Organization 的全部 typed HTTP operation。
// 069/076：Operation 统一使用 WebUI Session（webuiSession）认证 profile，
// mutation operation 额外经 MutationGuard 校验 Origin/Session/CSRF。
func Register(api huma.API, operations organizationhandler.Operations, guard MutationGuard) {
	huma.Register(api, organizationOperation("organization.departments.list", http.MethodGet, "/api/v1/organization/departments", "organization:department:read", "organization.department.list", http.StatusOK), func(ctx context.Context, input *organizationListInput) (*departmentListOutput, error) {
		value, err := operations.ListDepartments(ctx, humaListParams(input))
		if err != nil {
			return nil, protocolError(ctx, err)
		}
		return &departmentListOutput{Body: value}, nil
	})
	huma.Register(api, organizationOperation("organization.departments.tree", http.MethodGet, "/api/v1/organization/departments/tree", "organization:department:read", "organization.department.tree", http.StatusOK), func(ctx context.Context, input *organizationTreeInput) (*departmentTreeOutput, error) {
		value, err := operations.DepartmentTree(ctx, organizationhandler.TreeParams{ActiveOnly: input.ActiveOnly.Pointer()})
		if err != nil {
			return nil, protocolError(ctx, err)
		}
		return &departmentTreeOutput{Body: value}, nil
	})
	huma.Register(api, organizationJSONMutationOperation("organization.departments.create", http.MethodPost, "/api/v1/organization/departments", "organization:department:write", "organization.department.create", http.StatusCreated, guard), func(ctx context.Context, input *createDepartmentInput) (*departmentOutput, error) {
		value, err := operations.CreateDepartment(ctx, input.Body)
		if err != nil {
			return nil, protocolError(ctx, err)
		}
		return &departmentOutput{Body: value}, nil
	})
	huma.Register(api, organizationJSONMutationOperation("organization.departments.update", http.MethodPatch, "/api/v1/organization/departments/{id}", "organization:department:write", "organization.department.update", http.StatusOK, guard), func(ctx context.Context, input *updateDepartmentInput) (*departmentOutput, error) {
		input.Body.ID = input.ID
		value, err := operations.UpdateDepartment(ctx, input.Body)
		if err != nil {
			return nil, protocolError(ctx, err)
		}
		return &departmentOutput{Body: value}, nil
	})
	huma.Register(api, organizationOperation("organization.positions.list", http.MethodGet, "/api/v1/organization/positions", "organization:position:read", "organization.position.list", http.StatusOK), func(ctx context.Context, input *organizationListInput) (*positionListOutput, error) {
		value, err := operations.ListPositions(ctx, humaListParams(input))
		if err != nil {
			return nil, protocolError(ctx, err)
		}
		return &positionListOutput{Body: value}, nil
	})
	huma.Register(api, organizationJSONMutationOperation("organization.positions.create", http.MethodPost, "/api/v1/organization/positions", "organization:position:write", "organization.position.create", http.StatusCreated, guard), func(ctx context.Context, input *createPositionInput) (*positionOutput, error) {
		value, err := operations.CreatePosition(ctx, input.Body)
		if err != nil {
			return nil, protocolError(ctx, err)
		}
		return &positionOutput{Body: value}, nil
	})
	huma.Register(api, organizationJSONMutationOperation("organization.positions.update", http.MethodPatch, "/api/v1/organization/positions/{id}", "organization:position:write", "organization.position.update", http.StatusOK, guard), func(ctx context.Context, input *updatePositionInput) (*positionOutput, error) {
		input.Body.ID = input.ID
		value, err := operations.UpdatePosition(ctx, input.Body)
		if err != nil {
			return nil, protocolError(ctx, err)
		}
		return &positionOutput{Body: value}, nil
	})
	huma.Register(api, organizationOperation("organization.assignments.get", http.MethodGet, "/api/v1/organization/accounts/{id}/assignment", "organization:department:read", "organization.assignment.read", http.StatusOK), func(ctx context.Context, input *organizationPathInput) (*assignmentOutput, error) {
		value, err := operations.GetAssignment(ctx, input.ID)
		if err != nil {
			return nil, protocolError(ctx, err)
		}
		return &assignmentOutput{Body: value}, nil
	})
	huma.Register(api, organizationJSONMutationOperation("organization.assignments.replace", http.MethodPut, "/api/v1/organization/accounts/{id}/assignment", "organization:department:write", "organization.assignment.replace", http.StatusOK, guard), func(ctx context.Context, input *replaceAssignmentInput) (*assignmentOutput, error) {
		input.Body.AccountID = input.ID
		value, err := operations.ReplaceAssignment(ctx, input.Body)
		if err != nil {
			return nil, protocolError(ctx, err)
		}
		return &assignmentOutput{Body: value}, nil
	})
}

func HumaRegistration(operations organizationhandler.Operations, guard MutationGuard) humabinding.Registration {
	return func(api huma.API) { Register(api, operations, guard) }
}
func humaListParams(input *organizationListInput) organizationhandler.ListParams {
	return organizationhandler.ListParams{Offset: input.Offset.Pointer(), Limit: input.Limit.Pointer(), ActiveOnly: input.ActiveOnly.Pointer(), Query: input.Query.Pointer()}
}
func protocolError(ctx context.Context, err error) error {
	return httpx.NewProtocolProblemError(ctx, err)
}
func organizationOperation(id, method, path, scope, action string, status int) huma.Operation {
	return humabinding.Define(huma.Operation{OperationID: id, Method: method, Path: path, Tags: []string{"Organization"}, DefaultStatus: status}, humabinding.Definition{Security: humabinding.SecurityWebUISession, Policy: humabinding.PolicyProtected, Scope: scope, Action: action})
}
func organizationJSONMutationOperation(id, method, path, scope, action string, status int, guard MutationGuard) huma.Operation {
	operation := humabinding.JSONDefinition(huma.Operation{OperationID: id, Method: method, Path: path, Tags: []string{"Organization"}, DefaultStatus: status, Middlewares: huma.Middlewares{mutationMiddleware(guard)}}, humabinding.Definition{Security: humabinding.SecurityWebUISession, Policy: humabinding.PolicyProtected, Scope: scope, Action: action})
	return operation
}

// mutationMiddleware 在 mutation operation 执行前校验 Origin/Session/CSRF；
// 守卫不可用时 fail closed，不静默放行。
func mutationMiddleware(guard MutationGuard) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		request, writer := humabinding.UnwrapHTTP(ctx)
		if guard == nil {
			httpx.WriteProblem(writer, request, fmt.Errorf("organization mutation guard is nil"))
			return
		}
		if err := guard.ValidateMutation(request); err != nil {
			httpx.WriteProblem(writer, request, err)
			return
		}
		next(ctx)
	}
}
