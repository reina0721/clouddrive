// Package humabinding 定义模块 binding 与 HTTP transport 之间的最小 Huma 接入契约。
package humabinding

import (
	"mime"
	"net/http"
	"reflect"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

const securityMetadata = "project.security"
const definitionMetadata = "project.definition"

// Registration 是无资源、可重复构造 OpenAPI 的模块 registration。
type Registration func(huma.API)

const (
	SecurityNone         = ""
	SecurityBearer       = "bearerAuth"
	SecurityWebUISession = "webuiSession"
	PolicyPublic         = "public"
	PolicyProtected      = "protected"
)

// Definition 是项目拥有的稳定 operation/policy 元数据，不暴露 Huma 类型给消费者。
type Definition struct {
	ID, Method, Path, Security, Policy, Scope, Action string
}

// UnwrapHTTP 只供模块级协议 middleware 读取原生 request/response；Router adapter
// 的具体类型不会扩散到模块 binding。
func UnwrapHTTP(ctx huma.Context) (*http.Request, http.ResponseWriter) {
	return humachi.Unwrap(ctx)
}

// Optional 保留 query 参数“缺失”与类型零值的区别，避免用魔法零值改变业务语义。
type Optional[T any] struct {
	Value T
	IsSet bool
}

func (value Optional[T]) Schema(registry huma.Registry) *huma.Schema {
	return huma.SchemaFromType(registry, reflect.TypeOf(value.Value))
}

func (value *Optional[T]) Receiver() reflect.Value {
	return reflect.ValueOf(value).Elem().Field(0)
}

func (value *Optional[T]) OnParamSet(isSet bool, _ any) { value.IsSet = isSet }

// Pointer 只在参数真实出现时返回值地址。
func (value *Optional[T]) Pointer() *T {
	if value == nil || !value.IsSet {
		return nil
	}
	return &value.Value
}

// Operation 附加项目 security 元数据，具体认证与授权仍由 transport Gate 执行。
func Operation(operation huma.Operation, security string) huma.Operation {
	return Define(operation, Definition{ID: operation.OperationID, Method: operation.Method, Path: operation.Path, Security: security})
}

// Define 将项目 operation 定义附加到 Huma operation。
func Define(operation huma.Operation, definition Definition) huma.Operation {
	if operation.Metadata == nil {
		operation.Metadata = make(map[string]any)
	}
	definition.ID, definition.Method, definition.Path = operation.OperationID, operation.Method, operation.Path
	operation.Metadata[securityMetadata] = definition.Security
	operation.Metadata[definitionMetadata] = definition
	if definition.Security == SecurityNone {
		operation.Security = []map[string][]string{}
	} else {
		operation.Security = []map[string][]string{{definition.Security: {}}}
	}
	return operation
}

// JSONOperation 在 Huma 解码前保持项目既有的显式 application/json 契约。
func JSONOperation(operation huma.Operation, security string) huma.Operation {
	operation = Operation(operation, security)
	operation.Middlewares = append(operation.Middlewares, requireJSONContentType)
	return operation
}

// JSONDefinition 为有 JSON body 的 operation 同时安装项目元数据与 media type 门禁。
func JSONDefinition(operation huma.Operation, definition Definition) huma.Operation {
	operation = Define(operation, definition)
	operation.Middlewares = append(operation.Middlewares, requireJSONContentType)
	return operation
}

func requireJSONContentType(ctx huma.Context, next func(huma.Context)) {
	request, writer := UnwrapHTTP(ctx)
	mediaType, _, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		httpx.WriteProblem(writer, request, &httpx.StatusError{StatusCode: http.StatusUnsupportedMediaType, Code: "unsupported_media_type", Message: "request Content-Type is not supported", Err: err})
		return
	}
	next(ctx)
}

// Security 返回 transport Gate 所需的项目 security 标识。
func Security(operation *huma.Operation) (string, bool) {
	if operation == nil {
		return "", false
	}
	value, ok := operation.Metadata[securityMetadata].(string)
	return value, ok
}

// DefinitionOf 返回 operation 的项目元数据。
func DefinitionOf(operation *huma.Operation) (Definition, bool) {
	if operation == nil {
		return Definition{}, false
	}
	value, ok := operation.Metadata[definitionMetadata].(Definition)
	return value, ok
}
