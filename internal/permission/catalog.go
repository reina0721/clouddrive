// Package permission 定义各业务模块贡献的精确权限目录。
//
// Catalog 只声明可用权限及其 owner，不存储角色关系，也不执行授权判断。
package permission

import (
	"fmt"
	"sort"
	"strings"

	"github.com/reina0721/clouddrive/internal/module"
)

// Key 是授权判断使用的稳定精确权限键；Catalog 不支持通配符。
type Key string

// Risk 表达权限一旦授予后的管理影响等级。风险由权限所属模块显式声明，
// 消费方不得按权限键命名或 HTTP method 自行推断。
type Risk string

const (
	RiskStandard Risk = "standard"
	RiskElevated Risk = "elevated"
	RiskCritical Risk = "critical"
)

// Definition 是一个业务模块拥有的权限声明。
type Definition struct {
	Key                  Key
	OwnerModuleID        module.ID
	DescriptionMessageID string
	Risk                 Risk
}

// Reference 记录 operation 或 WebUI route 对权限键的引用，便于给出可定位的校验错误。
type Reference struct {
	Key          Key
	ConsumerType string
	ConsumerID   string
}

// Catalog 是按 Key 稳定排序的不可变权限目录。
type Catalog struct {
	definitions []Definition
	byKey       map[Key]Definition
}

// BuildCatalog 校验并聚合显式权限声明。
func BuildCatalog(definitions ...Definition) (Catalog, error) {
	copyDefinitions := append([]Definition(nil), definitions...)
	sort.Slice(copyDefinitions, func(left, right int) bool { return copyDefinitions[left].Key < copyDefinitions[right].Key })
	byKey := make(map[Key]Definition, len(copyDefinitions))
	for index, definition := range copyDefinitions {
		if err := validateDefinition(definition); err != nil {
			return Catalog{}, fmt.Errorf("permission definition %d: %w", index, err)
		}
		if previous, exists := byKey[definition.Key]; exists {
			return Catalog{}, fmt.Errorf("permission key %q is shared by modules %q and %q", definition.Key, previous.OwnerModuleID, definition.OwnerModuleID)
		}
		byKey[definition.Key] = definition
	}
	return Catalog{definitions: copyDefinitions, byKey: byKey}, nil
}

// Definitions 返回稳定排序的目录副本。
func (catalog Catalog) Definitions() []Definition {
	return append([]Definition(nil), catalog.definitions...)
}

// Lookup 按精确 Key 查找定义。
func (catalog Catalog) Lookup(key Key) (Definition, bool) {
	definition, exists := catalog.byKey[key]
	return definition, exists
}

// ValidateReferences 确认所有消费方只引用当前目录中的精确权限键。
func (catalog Catalog) ValidateReferences(references ...Reference) error {
	for index, reference := range references {
		if strings.TrimSpace(reference.ConsumerType) == "" || strings.TrimSpace(reference.ConsumerID) == "" {
			return fmt.Errorf("permission reference %d has incomplete consumer identity", index)
		}
		if !validKey(reference.Key) {
			return fmt.Errorf("%s %q references invalid permission key %q", reference.ConsumerType, reference.ConsumerID, reference.Key)
		}
		if _, exists := catalog.byKey[reference.Key]; !exists {
			return fmt.Errorf("%s %q references unknown permission key %q", reference.ConsumerType, reference.ConsumerID, reference.Key)
		}
	}
	return nil
}

func validateDefinition(definition Definition) error {
	if !validKey(definition.Key) {
		return fmt.Errorf("key %q is invalid", definition.Key)
	}
	if !validOwner(definition.OwnerModuleID) {
		return fmt.Errorf("owner module id %q is invalid", definition.OwnerModuleID)
	}
	if strings.TrimSpace(definition.DescriptionMessageID) != definition.DescriptionMessageID || definition.DescriptionMessageID == "" {
		return fmt.Errorf("permission %q description message id is required", definition.Key)
	}
	if definition.Risk != RiskStandard && definition.Risk != RiskElevated && definition.Risk != RiskCritical {
		return fmt.Errorf("permission %q risk %q is invalid", definition.Key, definition.Risk)
	}
	return nil
}

func validKey(key Key) bool {
	value := string(key)
	if strings.TrimSpace(value) != value || strings.ContainsAny(value, "*? ") {
		return false
	}
	parts := strings.Split(value, ":")
	if len(parts) < 2 {
		return false
	}
	for _, part := range parts {
		if !validIdentifier(part) {
			return false
		}
	}
	return true
}

func validOwner(owner module.ID) bool { return validIdentifier(string(owner)) }

func validIdentifier(value string) bool {
	if value == "" || value[0] < 'a' || value[0] > 'z' {
		return false
	}
	for _, character := range value {
		if (character < 'a' || character > 'z') && (character < '0' || character > '9') && character != '-' && character != '_' {
			return false
		}
	}
	return true
}
