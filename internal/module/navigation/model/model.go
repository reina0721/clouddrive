// Package model 定义后台导航策略的稳定领域模型。
package model

import (
	"errors"
	"strings"
	"time"
)

type Order int

const (
	MinimumOrder Order = -1_000_000
	MaximumOrder Order = 1_000_000
)

var (
	ErrUnknown        = errors.New("navigation item is unknown")
	ErrNotManageable  = errors.New("navigation item is not manageable")
	ErrCycle          = errors.New("navigation parent cycle")
	ErrInvalidParent  = errors.New("navigation parent is invalid")
	ErrInvalidOrder   = errors.New("navigation order is invalid")
	ErrCatalogChanged = errors.New("navigation catalog changed")
	ErrConflict       = errors.New("navigation policy conflict")
)

// Definition 是静态 Catalog 向 Navigation 暴露的窄只读视图。
type Definition struct {
	ID, ModuleID, RouteID, TitleMessageID, IconID string
	DefaultParentID                               string
	DefaultOrder                                  Order
	Manageable                                    bool
}

// Policy 是 Navigation 唯一可持久化的稀疏策略字段。
type Policy struct {
	Label                  string
	PresentationPermission string
	NavigationID           string
	Enabled                bool
	ParentOverride         *string
	OrderOverride          *Order
	CatalogRevision        string
	Version                uint64
	UpdatedAt              time.Time
}

// Menu 是管理 API 的静态定义与有效策略合并视图。
type Menu struct {
	Label                  string
	PresentationPermission string
	Definition
	Enabled          bool
	ParentID         string
	Order            Order
	Version          uint64
	Overridden       bool
	ParentOverridden bool
	OrderOverridden  bool
}

type Snapshot struct {
	CatalogRevision    string
	NavigationRevision string
	Policies           []Policy
}

func ValidatePolicy(policy Policy) error {
	if strings.TrimSpace(policy.NavigationID) == "" {
		return ErrUnknown
	}
	if len([]rune(policy.Label)) > 40 || len(policy.PresentationPermission) > 160 {
		return ErrInvalidParent
	}
	if policy.OrderOverride != nil && (*policy.OrderOverride < MinimumOrder || *policy.OrderOverride > MaximumOrder) {
		return ErrInvalidOrder
	}
	if policy.ParentOverride != nil && *policy.ParentOverride == policy.NavigationID {
		return ErrCycle
	}
	return nil
}
