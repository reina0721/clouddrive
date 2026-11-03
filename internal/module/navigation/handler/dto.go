// Package handler 提供 Navigation 顶层 HTTP DTO 与业务适配。
package handler

type Menu struct {
	Label            string `json:"label"`
	Permission       string `json:"permission"`
	ID               string `json:"id"`
	ModuleID         string `json:"moduleId"`
	RouteID          string `json:"routeId"`
	TitleMessageID   string `json:"titleMessageId"`
	IconID           string `json:"iconId"`
	DefaultParentID  string `json:"defaultParentId"`
	DefaultOrder     int    `json:"defaultOrder"`
	Enabled          bool   `json:"enabled"`
	ParentID         string `json:"parentId"`
	Order            int    `json:"order"`
	Version          uint64 `json:"version"`
	Overridden       bool   `json:"overridden"`
	ParentOverridden bool   `json:"parentOverridden"`
	OrderOverridden  bool   `json:"orderOverridden"`
}

type MenuList struct {
	Items              []Menu `json:"items"`
	CatalogRevision    string `json:"catalogRevision"`
	NavigationRevision string `json:"navigationRevision"`
}
type UpdateMenuRequest struct {
	Label          string  `json:"label"`
	Permission     string  `json:"permission"`
	ID             string  `json:"-"`
	Enabled        bool    `json:"enabled"`
	ParentOverride *string `json:"parentOverride,omitempty"`
	OrderOverride  *int    `json:"orderOverride,omitempty"`
	Version        uint64  `json:"version"`
}
type Revision struct {
	CatalogRevision    string `json:"catalogRevision"`
	NavigationRevision string `json:"navigationRevision"`
}
