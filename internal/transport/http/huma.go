package httptransport

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"sort"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

func newHumaAPI(router chi.Router, gate OperationGate) huma.API {
	config := huma.DefaultConfig("clouddrive HTTP API", "1.0.0-rc.1")
	config.Info.Description = "当前模板的公开 HTTP 契约。所有失败使用 RFC 9457 Problem Details；operation 的认证与授权由项目 gate 统一执行。"
	config.OpenAPIPath = ""
	config.DocsPath = ""
	config.SchemasPath = ""
	config.CreateHooks = nil
	config.Components.SecuritySchemes = map[string]*huma.SecurityScheme{
		humabinding.SecurityBearer:       {Type: "http", Scheme: "bearer", BearerFormat: "JWT"},
		humabinding.SecurityWebUISession: {Type: "apiKey", In: "cookie", Name: "go_scaffold_session"},
	}

	adapter := &problemAdapter{Adapter: humachi.NewAdapter(router)}
	api := huma.NewAPI(config, adapter)
	api.UseMiddleware(humaOperationGate(gate))
	return api
}

// BuildHumaOpenAPI30 从无资源 registration 生成 OpenAPI 3.0.3，供静态生成门禁复用。
func BuildHumaOpenAPI30(registrations ...humabinding.Registration) ([]byte, error) {
	api, err := buildHumaAPI(registrations)
	if err != nil {
		return nil, err
	}
	payload, err := api.OpenAPI().DowngradeYAML()
	if err != nil {
		return nil, fmt.Errorf("downgrade Huma OpenAPI: %w", err)
	}
	return payload, nil
}

// BuildHumaOperationCatalog 从相同无资源 registration 提取稳定项目元数据。
func BuildHumaOperationCatalog(registrations ...humabinding.Registration) ([]humabinding.Definition, error) {
	api, err := buildHumaAPI(registrations)
	if err != nil {
		return nil, err
	}
	definitions := make([]humabinding.Definition, 0)
	seen := make(map[string]struct{})
	for _, pathItem := range api.OpenAPI().Paths {
		for _, operation := range humaPathOperations(pathItem) {
			if operation == nil {
				continue
			}
			definition, ok := humabinding.DefinitionOf(operation)
			if !ok || definition.ID == "" || definition.Method == "" || definition.Path == "" || definition.Policy == "" {
				return nil, fmt.Errorf("Huma operation %q has incomplete project metadata", operation.OperationID)
			}
			if _, exists := seen[definition.ID]; exists {
				return nil, fmt.Errorf("Huma operation %q is duplicated", definition.ID)
			}
			seen[definition.ID] = struct{}{}
			definitions = append(definitions, definition)
		}
	}
	sort.Slice(definitions, func(left, right int) bool { return definitions[left].ID < definitions[right].ID })
	return definitions, nil
}

func buildHumaAPI(registrations []humabinding.Registration) (huma.API, error) {
	api := newHumaAPI(chi.NewRouter(), nil)
	for index, registration := range registrations {
		if registration == nil {
			return nil, fmt.Errorf("Huma registration %d is nil", index)
		}
		registration(api)
	}
	// Huma 负责生成错误 response，但运行时由项目 Problem 契约统一呈现。
	// 在同一 OpenAPI registry 中替换默认模型，避免文档声称另一套错误字段。
	registry := api.OpenAPI().Components.Schemas
	registry.Map()["ErrorModel"] = registry.Schema(reflect.TypeOf(httpx.Problem{}), false, "ProjectProblem")
	return api, nil
}

func humaPathOperations(item *huma.PathItem) []*huma.Operation {
	if item == nil {
		return nil
	}
	return []*huma.Operation{item.Get, item.Post, item.Put, item.Patch, item.Delete, item.Head, item.Options, item.Trace}
}

func humaOperationGate(gate OperationGate) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		request, writer := humachi.Unwrap(ctx)
		operationID := ctx.Operation().OperationID
		securityValue, ok := humabinding.Security(ctx.Operation())
		if !ok {
			httpx.WriteProblem(writer, request, fmt.Errorf("operation %q has no project security metadata", operationID))
			return
		}
		requestContext := httpx.WithOperationID(request.Context(), operationID)
		requestContext = httpx.WithRequestLanguage(requestContext, request.Header.Get(acceptLanguageHeader))
		request = request.WithContext(requestContext)
		authenticated, err := gate.Authenticate(request, securityValue)
		if err != nil {
			writeGateError(writer, request, err)
			return
		}
		if err := gate.Enforce(authenticated.Context(), operationID); err != nil {
			writeGateError(writer, authenticated, err)
			return
		}
		next(huma.WithContext(ctx, authenticated.Context()))
	}
}

// problemAdapter 只规范化 Huma 自身的解析/校验错误。业务错误已由项目
// ProtocolProblemError 表达，不会在这里丢失稳定 code 或 request instance。
type problemAdapter struct {
	huma.Adapter
}

func (adapter *problemAdapter) Handle(operation *huma.Operation, handler func(huma.Context)) {
	adapter.Adapter.Handle(operation, func(ctx huma.Context) {
		buffer := &bufferedHumaContext{embeddedHumaContext: ctx, response: &humaResponseBuffer{header: make(http.Header)}}
		handler(buffer)
		buffer.flush()
	})
}

type bufferedHumaContext struct {
	embeddedHumaContext
	response *humaResponseBuffer
}

type embeddedHumaContext interface{ huma.Context }

type humaResponseBuffer struct {
	header http.Header
	status int
	body   bytes.Buffer
}

func (ctx *bufferedHumaContext) Unwrap() huma.Context { return ctx.embeddedHumaContext }

func (ctx *bufferedHumaContext) WithContext(value context.Context) huma.Context {
	return &bufferedHumaContext{embeddedHumaContext: huma.WithContext(ctx.embeddedHumaContext, value), response: ctx.response}
}

func (ctx *bufferedHumaContext) SetStatus(status int) { ctx.response.status = status }
func (ctx *bufferedHumaContext) Status() int          { return ctx.response.status }
func (ctx *bufferedHumaContext) SetHeader(name, value string) {
	ctx.response.header.Set(name, value)
}
func (ctx *bufferedHumaContext) AppendHeader(name, value string) {
	ctx.response.header.Add(name, value)
}
func (ctx *bufferedHumaContext) BodyWriter() io.Writer { return &ctx.response.body }

func (ctx *bufferedHumaContext) flush() {
	request, writer := humachi.Unwrap(ctx.embeddedHumaContext)
	if ctx.response.status >= http.StatusBadRequest && !isProjectProblem(ctx.response.body.Bytes()) {
		status, code, message := humaValidationProblem(ctx.response.status)
		httpx.WriteProblem(writer, request, &httpx.StatusError{StatusCode: status, Code: code, Message: message})
		return
	}
	for name, values := range ctx.response.header {
		for _, value := range values {
			writer.Header().Add(name, value)
		}
	}
	if ctx.response.status != 0 {
		writer.WriteHeader(ctx.response.status)
	}
	_, _ = writer.Write(ctx.response.body.Bytes())
}

func isProjectProblem(payload []byte) bool {
	var problem struct {
		Code string `json:"code"`
	}
	return json.Unmarshal(payload, &problem) == nil && problem.Code != ""
}

func humaValidationProblem(status int) (int, string, string) {
	switch status {
	case http.StatusRequestEntityTooLarge:
		return status, "request_body_too_large", "request body exceeds the configured limit"
	case http.StatusUnsupportedMediaType:
		return status, "unsupported_media_type", "request Content-Type is not supported"
	default:
		return http.StatusBadRequest, "invalid_request", "request does not match the OpenAPI contract"
	}
}
