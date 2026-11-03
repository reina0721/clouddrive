package service

import "strings"

// accountSortColumns 是账号列表允许的排序列（服务端白名单；与 repo 层
// accountSortColumn 保持一致，保证非法排序在到达 DB 前被稳定拒绝）。
var accountSortColumns = map[string]struct{}{
	"username":     {},
	"display_name": {},
	"status":       {},
	"created_at":   {},
}

// validateAccountSort 校验账号列表排序值（"column:asc|desc"）：空值合法
// （默认排序）；列或方向非法返回 ErrInvalidQuery。
func validateAccountSort(value string) error {
	return validateListSort(value, accountSortColumns)
}

// validateListSort 校验通用排序值（account/role/session/api-token 等使用
// 白名单排序的列表）：空值合法；列必须属于白名单、方向必须是 asc|desc。
// 列白名单由调用方传入（与 repo listOrder 的 columns 一致），保证非法列
// 稳定报错而不是静默回退默认。
func validateListSort(value string, columns map[string]struct{}) error {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ":")
	if len(parts) != 2 || (parts[1] != "asc" && parts[1] != "desc") {
		return ErrInvalidQuery
	}
	if _, ok := columns[parts[0]]; !ok {
		return ErrInvalidQuery
	}
	return nil
}

var (
	roleSortColumns = map[string]struct{}{
		"code": {}, "name": {}, "createdAt": {},
	}
	sessionSortColumns = map[string]struct{}{
		"createdAt": {}, "lastSeenAt": {}, "idleExpiresAt": {},
	}
	apiTokenSortColumns = map[string]struct{}{
		"name": {}, "createdAt": {}, "expiresAt": {}, "lastUsedAt": {},
	}
)
