// Package handler 提供 Organization 模块顶层 HTTP DTO 与业务适配。
package handler

import "time"

type CreateDepartmentRequest struct {
	Leader   string  `json:"leader"`
	Remark   string  `json:"remark"`
	Code     string  `json:"code"`
	Name     string  `json:"name"`
	ParentID *string `json:"parentId,omitempty"`
}

type UpdateDepartmentRequest struct {
	Leader      *string `json:"leader,omitempty"`
	Remark      *string `json:"remark,omitempty"`
	ID          string  `json:"-"`
	Version     uint64  `json:"version"`
	Name        *string `json:"name,omitempty"`
	ParentID    *string `json:"parentId,omitempty"`
	ClearParent bool    `json:"clearParent,omitempty"`
	Active      *bool   `json:"active,omitempty"`
	Archived    *bool   `json:"archived,omitempty"`
}

type Department struct {
	Leader      string    `json:"leader"`
	Remark      string    `json:"remark"`
	MemberCount int64     `json:"memberCount"`
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	ParentID    *string   `json:"parentId,omitempty"`
	Active      bool      `json:"active"`
	Archived    bool      `json:"archived"`
	Version     uint64    `json:"version"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type DepartmentNode struct {
	Department
	Children []DepartmentNode `json:"children"`
}

type DepartmentList struct {
	Items  []Department `json:"items"`
	Offset int          `json:"offset"`
	Limit  int          `json:"limit"`
	Total  int64        `json:"total"`
}

type ListParams struct {
	Offset     *int    `form:"offset"`
	Limit      *int    `form:"limit"`
	ActiveOnly *bool   `form:"activeOnly"`
	Query      *string `form:"query"`
}

type TreeParams struct {
	ActiveOnly *bool `form:"activeOnly"`
}

type CreatePositionRequest struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type UpdatePositionRequest struct {
	ID       string  `json:"-"`
	Version  uint64  `json:"version"`
	Name     *string `json:"name,omitempty"`
	Active   *bool   `json:"active,omitempty"`
	Archived *bool   `json:"archived,omitempty"`
}

type Position struct {
	ID        string    `json:"id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Active    bool      `json:"active"`
	Archived  bool      `json:"archived"`
	Version   uint64    `json:"version"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type PositionList struct {
	Items  []Position `json:"items"`
	Offset int        `json:"offset"`
	Limit  int        `json:"limit"`
	Total  int64      `json:"total"`
}

type ReplaceAssignmentRequest struct {
	AccountID       string   `json:"-"`
	ExpectedVersion uint64   `json:"expectedVersion"`
	DepartmentID    *string  `json:"departmentId,omitempty"`
	PositionIDs     []string `json:"positionIds"`
}

type Assignment struct {
	AccountID    string   `json:"accountId"`
	DepartmentID *string  `json:"departmentId,omitempty"`
	PositionIDs  []string `json:"positionIds"`
	Version      uint64   `json:"version"`
}
