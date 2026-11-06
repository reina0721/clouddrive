package humabinding

import (
	"encoding/json"
	"github.com/danielgtaylor/huma/v2"
	"reflect"
)

// Nullable 在HTTP边界表达明确null或有类型的值，避免把对象引用的null误声明为普通对象。
// Huma的nullable字段标签只支持标量；公开SchemaProvider和JSON编码共同保持同一协议语义。
type Nullable[T any] struct{ Value *T }

// MarshalJSON 保留对象与显式null的区别。
func (value Nullable[T]) MarshalJSON() ([]byte, error) { return json.Marshal(value.Value) }

// UnmarshalJSON 将绑定边界已经校验的对象或null解码为有类型的指针。
func (value *Nullable[T]) UnmarshalJSON(payload []byte) error {
	return json.Unmarshal(payload, &value.Value)
}

// Schema 复用T的严格对象定义，另一个分支只接受null。
func (value Nullable[T]) Schema(registry huma.Registry) *huma.Schema {
	return &huma.Schema{AnyOf: []*huma.Schema{
		registry.Schema(reflect.TypeFor[T](), true, ""),
		{Type: huma.TypeObject, Nullable: true, Enum: []any{nil}},
	}}
}
