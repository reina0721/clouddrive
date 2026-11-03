package repo

import (
	"context"
	"errors"
	"fmt"
	"sort"

	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	"gorm.io/gorm"
)

// ErrSnapshotIncompatible 表示数据库中的授权关系无法构成当前 Catalog 兼容的
// policy snapshot；调用方必须 fail closed，不能降级或跳过未知权限。
var ErrSnapshotIncompatible = errors.New("iam policy snapshot is incompatible")

type accountRoleQueryRow struct {
	AccountID string `gorm:"column:account_id"`
	RoleID    string `gorm:"column:role_id"`
}
type rolePermissionQueryRow struct {
	RoleID        string `gorm:"column:role_id"`
	PermissionKey string `gorm:"column:permission_key"`
}

// AuthorizationSnapshot 读取当前 authorization revision 的完整授权投影并完成
// 规范化：只保留 active AccountRole、active 且未归档 Role 与其 active
// RolePermission；规则按稳定顺序去重；所有 PermissionKey 必须属于 catalog。
// 该调用必须与服务端决策使用同一数据库边界（mutation 时为同一事务）。
func (unit *Unit) AuthorizationSnapshot(ctx context.Context, catalog permissioncatalog.Catalog) (PolicySnapshot, error) {
	revision, err := unit.CurrentAuthorizationRevision(ctx)
	if err != nil {
		return PolicySnapshot{}, err
	}
	var accountRows []accountRoleQueryRow
	err = unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(accountRoleTable+" AS ar").
			Select("ar.account_id, ar.role_id").
			Joins("JOIN "+roleTable+" AS r ON r.id = ar.role_id").
			Where("ar.active = ? AND r.active = ? AND r.archived = ?", true, true, false).
			Order("ar.account_id ASC, ar.role_id ASC").
			Find(&accountRows).Error
	})
	if err != nil {
		return PolicySnapshot{}, fmt.Errorf("read account role snapshot: %w", err)
	}
	var permissionRows []rolePermissionQueryRow
	err = unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(rolePermissionTable+" AS rp").
			Select("rp.role_id, rp.permission_key").
			Joins("JOIN "+roleTable+" AS r ON r.id = rp.role_id").
			Where("rp.active = ? AND r.active = ? AND r.archived = ?", true, true, false).
			Order("rp.role_id ASC, rp.permission_key ASC").
			Find(&permissionRows).Error
	})
	if err != nil {
		return PolicySnapshot{}, fmt.Errorf("read role permission snapshot: %w", err)
	}
	roles := make([]AccountRoleRule, 0, len(accountRows))
	seenRoles := make(map[AccountRoleRule]struct{}, len(accountRows))
	for _, row := range accountRows {
		rule := AccountRoleRule{
			Account: PolicySubjectPrefix + row.AccountID,
			Role:    PolicyRolePrefix + row.RoleID,
		}
		if _, exists := seenRoles[rule]; exists {
			continue
		}
		seenRoles[rule] = struct{}{}
		roles = append(roles, rule)
	}
	permissions := make([]RolePermissionRule, 0, len(permissionRows))
	seenPermissions := make(map[RolePermissionRule]struct{}, len(permissionRows))
	for _, row := range permissionRows {
		key := permissioncatalog.Key(row.PermissionKey)
		if _, known := catalog.Lookup(key); !known {
			return PolicySnapshot{}, fmt.Errorf("%w: unknown active permission %q", ErrSnapshotIncompatible, key)
		}
		rule := RolePermissionRule{
			Role:       PolicyRolePrefix + row.RoleID,
			Permission: PolicyPermissionPrefix + string(key),
		}
		if _, exists := seenPermissions[rule]; exists {
			continue
		}
		seenPermissions[rule] = struct{}{}
		permissions = append(permissions, rule)
	}
	sort.Slice(roles, func(i, j int) bool {
		if roles[i].Account != roles[j].Account {
			return roles[i].Account < roles[j].Account
		}
		return roles[i].Role < roles[j].Role
	})
	sort.Slice(permissions, func(i, j int) bool {
		if permissions[i].Role != permissions[j].Role {
			return permissions[i].Role < permissions[j].Role
		}
		return permissions[i].Permission < permissions[j].Permission
	})
	return PolicySnapshot{Revision: revision, AccountRoles: roles, RolePermissions: permissions}, nil
}
