package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	todohandler "github.com/reina0721/clouddrive/internal/module/todo/handler"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

type listTodosInput struct {
	Status humabinding.Optional[todohandler.TodoStatus] `query:"status" enum:"pending,completed"`
	Offset humabinding.Optional[int]                    `query:"offset" minimum:"0"`
	Limit  humabinding.Optional[int]                    `query:"limit" minimum:"1"`
}
type createTodoInput struct{ Body todohandler.CreateTodoRequest }
type todoPathInput struct {
	ID string `path:"id" minLength:"1" maxLength:"36"`
}
type todoOutput struct{ Body todohandler.Todo }
type listTodosOutput struct{ Body todohandler.TodoList }

// Register 注册 Todo 的全部 typed HTTP operation。
func Register(api huma.API, operations todohandler.Operations) {
	huma.Register(api, todoJSONOperation("createTodo", http.MethodPost, "/api/v1/todos", "todos:write", "todo.create", http.StatusCreated), func(ctx context.Context, input *createTodoInput) (*todoOutput, error) {
		result, err := operations.CreateTodo(ctx, input.Body)
		return todoResult(ctx, result, err)
	})
	huma.Register(api, todoOperation("listTodos", http.MethodGet, "/api/v1/todos", "todos:read", "todo.list", http.StatusOK), func(ctx context.Context, input *listTodosInput) (*listTodosOutput, error) {
		result, err := operations.ListTodos(ctx, todohandler.ListTodosParams{Status: input.Status.Pointer(), Offset: input.Offset.Pointer(), Limit: input.Limit.Pointer()})
		if err != nil {
			return nil, httpx.NewProtocolProblemError(ctx, err)
		}
		return &listTodosOutput{Body: result}, nil
	})
	huma.Register(api, todoOperation("getTodo", http.MethodGet, "/api/v1/todos/{id}", "todos:read", "todo.read", http.StatusOK), func(ctx context.Context, input *todoPathInput) (*todoOutput, error) {
		result, err := operations.GetTodo(ctx, input.ID)
		return todoResult(ctx, result, err)
	})
	huma.Register(api, todoOperation("completeTodo", http.MethodPatch, "/api/v1/todos/{id}/complete", "todos:write", "todo.complete", http.StatusOK), func(ctx context.Context, input *todoPathInput) (*todoOutput, error) {
		result, err := operations.CompleteTodo(ctx, input.ID)
		return todoResult(ctx, result, err)
	})
}

func HumaRegistration(operations todohandler.Operations) humabinding.Registration {
	return func(api huma.API) { Register(api, operations) }
}

func todoOperation(id, method, path, scope, action string, status int) huma.Operation {
	return humabinding.Define(huma.Operation{OperationID: id, Method: method, Path: path, Tags: []string{"Todo"}, DefaultStatus: status}, humabinding.Definition{Security: humabinding.SecurityBearer, Policy: humabinding.PolicyProtected, Scope: scope, Action: action})
}
func todoJSONOperation(id, method, path, scope, action string, status int) huma.Operation {
	return humabinding.JSONDefinition(huma.Operation{OperationID: id, Method: method, Path: path, Tags: []string{"Todo"}, DefaultStatus: status}, humabinding.Definition{Security: humabinding.SecurityBearer, Policy: humabinding.PolicyProtected, Scope: scope, Action: action})
}
func todoResult(ctx context.Context, result todohandler.Todo, err error) (*todoOutput, error) {
	if err != nil {
		return nil, httpx.NewProtocolProblemError(ctx, err)
	}
	return &todoOutput{Body: result}, nil
}
