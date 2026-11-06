package repo

import (
	"context"
	"fmt"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"time"
)

// maxCollaborationRoles 约束本次身份快照的关系行数；超额整体失败，不能截断拒绝角色。
const maxCollaborationRoles = 1000

type collaborationAccountRow struct {
	AccountID, Username, DisplayName, Status string
	Archived, MustChangePassword             bool
	LockedUntil                              *time.Time
	RoleID, RoleCode                         *string
	RoleSystem                               *bool
}

func (store *Store) readAudience(ctx context.Context, read func(*gorm.DB) error) error {
	return store.access.Use(ctx, func(client database.Client) error { return database.UseGORM(ctx, client, read) })
}

// CollaborationAccount 通过单条只读语句取得同一快照的账号和有效角色，不在文件写事务内另开写事务。
func (store *Store) CollaborationAccount(ctx context.Context, id string) (AccountRecord, []RoleRecord, error) {
	var rows []collaborationAccountRow
	err := store.readAudience(ctx, func(db *gorm.DB) error {
		return db.Table(accountTable+" AS account_item").Select("account_item.id AS account_id, account_item.username, account_item.display_name, account_item.status, account_item.archived, account_item.must_change_password, account_item.locked_until, role_item.id AS role_id, role_item.code AS role_code, role_item.system AS role_system").Joins("LEFT JOIN "+accountRoleTable+" AS membership ON membership.account_id = account_item.id AND membership.active = ?", true).Joins("LEFT JOIN "+roleTable+" AS role_item ON role_item.id = membership.role_id AND role_item.active = ? AND role_item.archived = ?", true, false).Where("account_item.id = ?", id).Order("role_item.id").Limit(maxCollaborationRoles + 1).Scan(&rows).Error
	})
	if err != nil {
		return AccountRecord{}, nil, err
	}
	if len(rows) == 0 {
		return AccountRecord{}, nil, ErrNotFound
	}
	if len(rows) > maxCollaborationRoles {
		return AccountRecord{}, nil, fmt.Errorf("collaboration role membership limit exceeded")
	}
	first := rows[0]
	account := AccountRecord{ID: first.AccountID, Username: first.Username, DisplayName: first.DisplayName, Status: first.Status, Archived: first.Archived, MustChangePassword: first.MustChangePassword, LockedUntil: first.LockedUntil}
	roles := []RoleRecord{}
	for _, row := range rows {
		if row.RoleID != nil && row.RoleCode != nil {
			roles = append(roles, RoleRecord{ID: *row.RoleID, Code: *row.RoleCode, Active: true, System: row.RoleSystem != nil && *row.RoleSystem})
		}
	}
	return account, roles, nil
}

// CollaborationAccountByUsername 只提供精确查找所需的低敏状态与标签。
func (store *Store) CollaborationAccountByUsername(ctx context.Context, username string) (AccountRecord, error) {
	var result AccountRecord
	err := store.readAudience(ctx, func(db *gorm.DB) error {
		return db.Table(accountTable).Select("id", "username", "display_name", "status", "archived", "must_change_password", "locked_until").Where("username = ?", username).First(&result).Error
	})
	return result, err
}

// CollaborationRole 读取规则目标的当前状态，不返回该角色的授权明细。
func (store *Store) CollaborationRole(ctx context.Context, id string) (RoleRecord, error) {
	var result RoleRecord
	err := store.readAudience(ctx, func(db *gorm.DB) error {
		return db.Table(roleTable).Select("id", "code", "name", "active", "archived", "system").Where("id = ?", id).First(&result).Error
	})
	return result, err
}

// CollaborationRoleByCode 按唯一编码精确定位角色，不提供目录枚举。
func (store *Store) CollaborationRoleByCode(ctx context.Context, code string) (RoleRecord, error) {
	var result RoleRecord
	err := store.readAudience(ctx, func(db *gorm.DB) error {
		return db.Table(roleTable).Select("id", "code", "name", "active", "archived", "system").Where("code = ?", code).First(&result).Error
	})
	return result, err
}
