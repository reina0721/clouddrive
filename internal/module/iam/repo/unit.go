package repo

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrNotFound = database.ErrNotFound

func IsNotFound(err error) bool  { return errors.Is(err, database.ErrNotFound) }
func IsDuplicate(err error) bool { return errors.Is(err, database.ErrDuplicateKey) }
func IsConflict(err error) bool  { return errors.Is(err, database.ErrOptimisticConflict) }

type AccountChanges struct {
	Username           *string
	Status             *string
	DisplayName        *string
	Nickname           *string
	Bio                *string
	BirthDate          *string
	Archived           *bool
	MustChangePassword *bool
	SecurityRevision   *uint64
	FailedAttempts     *int
	LockedUntil        **time.Time
	UpdatedAt          time.Time
}

// AccountFilter 是账号列表的 typed 过滤条件；空字段表示不过滤。
type AccountFilter struct {
	// Query 按用户名/显示名关键字模糊匹配（与既有列表语义一致）。
	Query string
	// Status 按账号状态精确过滤（""/active/disabled）。
	Status string
	// Archived 按归档标记过滤（nil=不过滤；false=仅未归档；true=仅已归档）。
	Archived *bool
	// RoleID 非空时只统计/返回拥有该活跃角色的账号。
	RoleID string
	// Sort 按白名单列排序（"name:asc|desc"/"username:asc|desc"/"status:asc|desc"，
	// "" = 默认 id 排序）。排序列白名单防注入。
	Sort string
}

// accountSortColumn 白名单：只允许真实列名，非法/未知值回退空。
func accountSortColumn(sort string) string {
	switch sort {
	case "username", "display_name", "status", "created_at":
		return sort
	default:
		return ""
	}
}

// accountQuery 构造账号列表/统计的公共过滤条件。
func (unit *Unit) accountQuery(ctx context.Context, db *gorm.DB, filter AccountFilter) *gorm.DB {
	query := db.Table(accountTable)
	if strings.TrimSpace(filter.Query) != "" {
		like := "%" + strings.TrimSpace(filter.Query) + "%"
		query = query.Where("(username LIKE ? OR display_name LIKE ?)", like, like)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Archived != nil {
		query = query.Where("archived = ?", *filter.Archived)
	}
	if strings.TrimSpace(filter.RoleID) != "" {
		query = query.Where("EXISTS (SELECT 1 FROM "+accountRoleTable+" r WHERE r.account_id = "+accountTable+".id AND r.role_id = ? AND r.active = ?)", strings.TrimSpace(filter.RoleID), true)
	}
	return query
}

// CountAccounts 统计满足过滤条件的账号总数（与 ListAccounts 同过滤语义）。
func (unit *Unit) CountAccounts(ctx context.Context, filter AccountFilter) (int64, error) {
	var count int64
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return unit.accountQuery(ctx, db, filter).Count(&count).Error
	})
	return count, err
}

func (unit *Unit) CreateAccount(ctx context.Context, value *AccountRecord) error {
	value.Version = 1
	return unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(accountTable).Create(value).Error })
}

func (unit *Unit) AccountByUsername(ctx context.Context, value string) (AccountRecord, error) {
	var record AccountRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(accountTable).Where("username = ?", value).First(&record).Error
	})
	return record, err
}

func (unit *Unit) AccountByID(ctx context.Context, value string) (AccountRecord, error) {
	var record AccountRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(accountTable).Where("id = ?", value).First(&record).Error
	})
	return record, err
}

func (unit *Unit) ListAccounts(ctx context.Context, offset, limit int, filter AccountFilter) ([]AccountRecord, error) {
	var records []AccountRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		order := "username ASC"
		if filter.Sort != "" {
			column, direction := sortParts(filter.Sort)
			if column != "" {
				order = column + " " + direction
			}
		}
		return unit.accountQuery(ctx, db, filter).Order(order).Offset(offset).Limit(limit).Find(&records).Error
	})
	return records, err
}

// sortParts 解析 "column:asc|desc"，列经白名单、方向白名单过滤防注入。
func sortParts(sort string) (column, direction string) {
	parts := strings.Split(sort, ":")
	if len(parts) != 2 {
		return "", ""
	}
	column = accountSortColumn(parts[0])
	if column == "" {
		return "", ""
	}
	switch parts[1] {
	case "asc", "desc":
		return column, parts[1]
	default:
		return column, "asc"
	}
}

func (unit *Unit) UpdateAccount(ctx context.Context, id string, version uint64, changes AccountChanges) error {
	values := map[string]any{"updated_at": changes.UpdatedAt, "version": gorm.Expr("version + 1")}
	if changes.Username != nil {
		values["username"] = *changes.Username
	}
	if changes.Status != nil {
		values["status"] = *changes.Status
	}
	if changes.DisplayName != nil {
		values["display_name"] = *changes.DisplayName
	}
	if changes.Nickname != nil {
		values["nickname"] = *changes.Nickname
	}
	if changes.Bio != nil {
		values["bio"] = *changes.Bio
	}
	if changes.BirthDate != nil {
		values["birth_date"] = *changes.BirthDate
	}
	if changes.Archived != nil {
		values["archived"] = *changes.Archived
	}
	if changes.MustChangePassword != nil {
		values["must_change_password"] = *changes.MustChangePassword
	}
	if changes.SecurityRevision != nil {
		values["security_revision"] = *changes.SecurityRevision
	}
	if changes.FailedAttempts != nil {
		values["failed_attempts"] = *changes.FailedAttempts
	}
	if changes.LockedUntil != nil {
		values["locked_until"] = *changes.LockedUntil
	}
	return unit.updateVersioned(ctx, accountTable, "id = ? AND version = ?", []any{id, version}, values)
}

// TouchAccount 只刷新账号 updated_at 并递增版本（乐观并发探针），不改变业务字段。
func (unit *Unit) TouchAccount(ctx context.Context, id string, version uint64, now time.Time) error {
	return unit.updateVersioned(ctx, accountTable, "id = ? AND version = ?", []any{id, version}, map[string]any{"updated_at": now, "version": gorm.Expr("version + 1")})
}

func (unit *Unit) CreateCredential(ctx context.Context, value *CredentialRecord) error {
	return unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(credentialTable).Create(value).Error })
}

func (unit *Unit) CredentialByAccount(ctx context.Context, id string) (CredentialRecord, error) {
	var record CredentialRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(credentialTable).Where("account_id = ?", id).First(&record).Error
	})
	return record, err
}

func (unit *Unit) UpdateCredential(ctx context.Context, id, hash string, now time.Time, expected ...uint64) error {
	return unit.update(ctx, credentialTable, "account_id = ?", []any{id}, map[string]any{"password_hash": hash, "updated_at": now, "password_changed_at": now})
}

// CreatePasswordHistory 记录一条口令哈希到历史（供 historySize 就近复用校验）。
func (unit *Unit) CreatePasswordHistory(ctx context.Context, value *PasswordHistoryRecord) error {
	return unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(passwordHistoryTable).Create(value).Error })
}

// PasswordHistoryHashes 返回账号最近 limit 条口令哈希（按创建时间降序；limit=0 返回空）。
func (unit *Unit) PasswordHistoryHashes(ctx context.Context, accountID string, limit int) ([]string, error) {
	var hashes []string
	if limit <= 0 {
		return hashes, nil
	}
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(passwordHistoryTable).Where("account_id = ?", accountID).Order("created_at DESC").Limit(limit).Pluck("password_hash", &hashes).Error
	})
	return hashes, err
}

// TrimPasswordHistory 只保留账号最近 keep 条口令历史，删除更旧的记录。
func (unit *Unit) TrimPasswordHistory(ctx context.Context, accountID string, keep int) error {
	if keep <= 0 {
		return nil
	}
	return unit.useDB(ctx, func(db *gorm.DB) error {
		recent := db.Table(passwordHistoryTable).Where("account_id = ?", accountID).Order("created_at DESC").Limit(keep).Select("created_at")
		return db.Table(passwordHistoryTable).Where("account_id = ? AND created_at NOT IN (?)", accountID, recent).Delete(nil).Error
	})
}

// CreateApiToken 写入一条机器访问令牌（名称/哈希/scope JSON/过期由 service 制备）。
func (unit *Unit) CreateApiToken(ctx context.Context, value *ApiTokenRecord) error {
	return unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(apiTokenTable).Create(value).Error })
}

// ApiTokenByID 按 token id 返回（必须是该账号所有）。
func (unit *Unit) ApiTokenByID(ctx context.Context, accountID, id string) (ApiTokenRecord, error) {
	var record ApiTokenRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(apiTokenTable).Where("id = ? AND account_id = ?", id, accountID).First(&record).Error
	})
	return record, err
}

// ApiTokenByHash 按 token 哈希返回（认证解析用，跨账号独立）。
func (unit *Unit) ApiTokenByHash(ctx context.Context, hash string) (ApiTokenRecord, error) {
	var record ApiTokenRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(apiTokenTable).Where("token_hash = ?", hash).First(&record).Error
	})
	return record, err
}

// CountApiTokens 统计账号未吊销令牌数（080：数量上限口径，revoked 不占额度）。
func (unit *Unit) CountApiTokens(ctx context.Context, accountID string) (int64, error) {
	var count int64
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(apiTokenTable).Where("account_id = ? AND revoked_at IS NULL", accountID).Count(&count).Error
	})
	return count, err
}

// ApiTokenFilter 是令牌列表的 typed 过滤条件（080）。
type ApiTokenFilter struct {
	// Status：active|disabled|expired|revoked|all（空等价 all）。
	Status string
	// Now 是过期判定基准时间。
	Now time.Time
}

// apiTokenQuery 构造账号令牌查询的公共过滤条件（Count/List 同条件）。
func (unit *Unit) apiTokenQuery(ctx context.Context, db *gorm.DB, accountID string, filter ApiTokenFilter) *gorm.DB {
	query := db.Table(apiTokenTable).Where("account_id = ?", accountID)
	switch filter.Status {
	case "active":
		query = query.Where("revoked_at IS NULL AND disabled_at IS NULL AND (expires_at IS NULL OR expires_at > ?)", filter.Now)
	case "disabled":
		query = query.Where("revoked_at IS NULL AND disabled_at IS NOT NULL")
	case "expired":
		query = query.Where("revoked_at IS NULL AND expires_at IS NOT NULL AND expires_at <= ?", filter.Now)
	case "revoked":
		query = query.Where("revoked_at IS NOT NULL")
	}
	return query
}

// CountApiTokensFiltered 统计满足 status 过滤的令牌总数（与 List 同条件）。
func (unit *Unit) CountApiTokensFiltered(ctx context.Context, accountID string, filter ApiTokenFilter) (int64, error) {
	var count int64
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return unit.apiTokenQuery(ctx, db, accountID, filter).Count(&count).Error
	})
	return count, err
}

// ListApiTokensFiltered 分页返回账号令牌（创建时间降序；status 过滤与 Count 同条件）。
func (unit *Unit) ListApiTokensFiltered(ctx context.Context, accountID string, offset, limit int, filter ApiTokenFilter, sortValue string) ([]ApiTokenRecord, error) {
	var records []ApiTokenRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		order, err := listOrder(sortValue, map[string]string{"name": "name", "createdAt": "created_at", "expiresAt": "expires_at", "lastUsedAt": "last_used_at"}, "created_at DESC, id ASC")
		if err != nil {
			return err
		}
		return unit.apiTokenQuery(ctx, db, accountID, filter).Order(order).Offset(offset).Limit(limit).Find(&records).Error
	})
	return records, err
}

// UpdateApiTokenFields 更新令牌字段（080）：changes 为受控字段 map
// （name/description/expires_at；expires_at=nil 表示清空过期为永不过期）。
func (unit *Unit) UpdateApiTokenFields(ctx context.Context, accountID, id string, changes map[string]any, expected ...uint64) error {
	return unit.updateApiToken(ctx, accountID, id, changes, expected...)
}

// SetApiTokenDisabled 设置令牌禁用状态（disabled 可逆；disabledAt 非空=禁用）。
func (unit *Unit) SetApiTokenDisabled(ctx context.Context, accountID, id string, disabledAt *time.Time, expected ...uint64) error {
	return unit.updateApiToken(ctx, accountID, id, map[string]any{"disabled_at": disabledAt}, expected...)
}

// RotateApiTokenHash 替换令牌哈希（轮换：旧哈希立即失效）并刷新修改时间。
func (unit *Unit) RotateApiTokenHash(ctx context.Context, accountID, id, hash string, now time.Time, expected ...uint64) error {
	values := map[string]any{"token_hash": hash, "revoked_at": nil, "last_used_at": nil, "created_at": now}
	return unit.updateApiToken(ctx, accountID, id, values, expected...)
}

// RevokeApiToken 把令牌置为终态吊销（同时清除禁用标记）。
func (unit *Unit) RevokeApiToken(ctx context.Context, accountID, id string, now time.Time, expected ...uint64) error {
	return unit.updateApiToken(ctx, accountID, id, map[string]any{"revoked_at": &now, "disabled_at": nil}, expected...)
}

// TouchApiTokenUsage 记录令牌最近使用时间（认证成功时调用，异步无承诺）。
func (unit *Unit) TouchApiTokenUsage(ctx context.Context, id string, now time.Time) error {
	return unit.update(ctx, apiTokenTable, "id = ?", []any{id}, map[string]any{"last_used_at": &now})
}

// UpsertMFASecret 覆盖账号的 TOTP 种子（重新绑定时替换已有 pending/确认记录）。
func (unit *Unit) UpsertMFASecret(ctx context.Context, value *MFASecretRecord) error {
	return unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(mfaSecretTable).Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "account_id"}},
			DoUpdates: clause.Assignments(map[string]any{
				"secret": value.Secret, "confirmed": value.Confirmed,
				"created_at": value.CreatedAt, "confirmed_at": value.ConfirmedAt,
			}),
		}).Create(value).Error
	})
}

// MFASecretByAccount 返回账号 TOTP 种子（无则为 ErrNotFound）。
func (unit *Unit) MFASecretByAccount(ctx context.Context, accountID string) (MFASecretRecord, error) {
	var record MFASecretRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(mfaSecretTable).Where("account_id = ?", accountID).First(&record).Error
	})
	return record, err
}

// ConfirmMFASecret 把 pending 种子置为已确认（绑定激活）。
func (unit *Unit) ConfirmMFASecret(ctx context.Context, accountID string, now time.Time) error {
	return unit.update(ctx, mfaSecretTable, "account_id = ?", []any{accountID}, map[string]any{"confirmed": true, "confirmed_at": &now})
}

// DeleteMFASecret 删除种子（与恢复码由调用方一并处理）。
func (unit *Unit) DeleteMFASecret(ctx context.Context, accountID string) error {
	return unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(mfaSecretTable).Where("account_id = ?", accountID).Delete(nil).Error
	})
}

// CreateRecoveryCodes 批量写入一次性恢复码哈希。
func (unit *Unit) CreateRecoveryCodes(ctx context.Context, values []MfaRecoveryCodeRecord) error {
	return unit.useDB(ctx, func(db *gorm.DB) error {
		for _, value := range values {
			if err := db.Table(mfaRecoveryCodeTable).Create(&value).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// RecoveryCodesByAccount 返回账号全部恢复码哈希。
func (unit *Unit) RecoveryCodesByAccount(ctx context.Context, accountID string) ([]string, error) {
	var hashes []string
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(mfaRecoveryCodeTable).Where("account_id = ?", accountID).Pluck("code_hash", &hashes).Error
	})
	return hashes, err
}

// MarkRecoveryCodeUsed 把单条恢复码置为已使用（只影响未使用行；
// 已使用则返回乐观冲突，调用方据此拒绝复用）。
func (unit *Unit) MarkRecoveryCodeUsed(ctx context.Context, accountID, hash string, now time.Time) error {
	return unit.updateVersioned(ctx, mfaRecoveryCodeTable, "account_id = ? AND code_hash = ? AND used_at IS NULL", []any{accountID, hash}, map[string]any{"used_at": &now})
}

// DeleteRecoveryCodes 删除账号全部恢复码（解绑 MFA 时）。
func (unit *Unit) DeleteRecoveryCodes(ctx context.Context, accountID string) error {
	return unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(mfaRecoveryCodeTable).Where("account_id = ?", accountID).Delete(nil).Error
	})
}

func (unit *Unit) CreateRole(ctx context.Context, value *RoleRecord) error {
	value.Version = 1
	return unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(roleTable).Create(value).Error })
}

func (unit *Unit) RoleByID(ctx context.Context, id string) (RoleRecord, error) {
	var record RoleRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(roleTable).Where("id = ?", id).First(&record).Error
	})
	return record, err
}

func (unit *Unit) OwnerRole(ctx context.Context) (RoleRecord, error) {
	var record RoleRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(roleTable).Where("code = ?", "owner").First(&record).Error
	})
	return record, err
}

func (unit *Unit) CountRoles(ctx context.Context) (int64, error) {
	var count int64
	err := unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(roleTable).Count(&count).Error })
	return count, err
}

// CountRolesMatching 统计匹配关键字过滤的角色总数（与 ListRoles 同过滤语义）。
func (unit *Unit) CountRolesMatching(ctx context.Context, query string) (int64, error) {
	var count int64
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		q := db.Table(roleTable)
		if strings.TrimSpace(query) != "" {
			like := "%" + strings.TrimSpace(query) + "%"
			q = q.Where("(code LIKE ? OR name LIKE ?)", like, like)
		}
		return q.Count(&count).Error
	})
	return count, err
}

func (unit *Unit) ListRoles(ctx context.Context, offset, limit int, query, sortValue string) ([]RoleRecord, error) {
	var records []RoleRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		q := db.Table(roleTable)
		if strings.TrimSpace(query) != "" {
			like := "%" + strings.TrimSpace(query) + "%"
			q = q.Where("(code LIKE ? OR name LIKE ?)", like, like)
		}
		order, err := listOrder(sortValue, map[string]string{"code": "code", "name": "name", "createdAt": "created_at"}, "code ASC")
		if err != nil {
			return err
		}
		return q.Order(order).Offset(offset).Limit(limit).Find(&records).Error
	})
	return records, err
}

// listOrder 将排序值转换为固定 SQL 片段；列名和方向都必须来自白名单。
func listOrder(value string, columns map[string]string, defaultOrder string) (string, error) {
	if strings.TrimSpace(value) == "" {
		return defaultOrder, nil
	}
	parts := strings.Split(value, ":")
	if len(parts) != 2 || (parts[1] != "asc" && parts[1] != "desc") {
		return "", fmt.Errorf("invalid list sort %q", value)
	}
	column, ok := columns[parts[0]]
	if !ok {
		return "", fmt.Errorf("invalid list sort column %q", parts[0])
	}
	return column + " " + parts[1], nil
}

func (unit *Unit) TouchRole(ctx context.Context, id string, version uint64, now time.Time) error {
	return unit.updateVersioned(ctx, roleTable, "id = ? AND version = ?", []any{id, version}, map[string]any{"updated_at": now, "version": gorm.Expr("version + 1")})
}

// RoleChanges 是角色信息的受控更新字段；nil 字段表示不修改。
type RoleChanges struct {
	Name        *string
	Description *string
	Active      *bool
	Archived    *bool
	UpdatedAt   time.Time
}

// UpdateRoleInfo 按乐观并发版本更新角色展示字段（名称/描述）或生命周期状态。
func (unit *Unit) UpdateRoleInfo(ctx context.Context, id string, version uint64, changes RoleChanges) error {
	values := map[string]any{"updated_at": changes.UpdatedAt, "version": gorm.Expr("version + 1")}
	if changes.Name != nil {
		values["name"] = *changes.Name
	}
	if changes.Description != nil {
		values["description"] = *changes.Description
	}
	if changes.Active != nil {
		values["active"] = *changes.Active
	}
	if changes.Archived != nil {
		values["archived"] = *changes.Archived
	}
	return unit.updateVersioned(ctx, roleTable, "id = ? AND version = ?", []any{id, version}, values)
}

func (unit *Unit) CreateAccountRole(ctx context.Context, value *AccountRoleRecord) error {
	return unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(accountRoleTable).Create(value).Error })
}

func (unit *Unit) ListAccountRolesByAccount(ctx context.Context, id string, activeOnly bool) ([]AccountRoleRecord, error) {
	var records []AccountRoleRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		query := db.Table(accountRoleTable).Where("account_id = ?", id)
		if activeOnly {
			query = query.Where("active = ?", true)
		}
		return query.Find(&records).Error
	})
	return records, err
}

func (unit *Unit) ListAccountRolesByRole(ctx context.Context, id string) ([]AccountRoleRecord, error) {
	var records []AccountRoleRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(accountRoleTable).Where("role_id = ? AND active = ?", id, true).Find(&records).Error
	})
	return records, err
}

// CountAccountRolesByRole 统计拥有该角色的活跃分配数（分页 total 用）。
func (unit *Unit) CountAccountRolesByRole(ctx context.Context, roleID string) (int64, error) {
	var count int64
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(accountRoleTable).Where("role_id = ? AND active = ?", roleID, true).Count(&count).Error
	})
	return count, err
}

// ListAccountsByRole 返回拥有指定活跃角色的账号（分页、按用户名稳定排序）；
// 供角色影响分析（归档/权限变更前查看持有者）。
func (unit *Unit) ListAccountsByRole(ctx context.Context, roleID string, offset, limit int) ([]AccountRecord, error) {
	var records []AccountRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(accountTable).
			Joins("JOIN "+accountRoleTable+" r ON r.account_id = "+accountTable+".id").
			Where("r.role_id = ? AND r.active = ?", roleID, true).
			Order(accountTable + ".username ASC").
			Offset(offset).Limit(limit).
			Find(&records).Error
	})
	return records, err
}

func (unit *Unit) HasRole(ctx context.Context, accountID, roleID string) (bool, error) {
	var count int64
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(accountRoleTable).Where("account_id = ? AND role_id = ? AND active = ?", accountID, roleID, true).Count(&count).Error
	})
	return count > 0, err
}

func (unit *Unit) UpdateAccountRole(ctx context.Context, accountID, roleID string, active bool, now time.Time) error {
	return unit.update(ctx, accountRoleTable, "account_id = ? AND role_id = ?", []any{accountID, roleID}, map[string]any{"active": active, "updated_at": now})
}

func (unit *Unit) CreateRolePermission(ctx context.Context, value *RolePermissionRecord) error {
	return unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(rolePermissionTable).Create(value).Error })
}

func (unit *Unit) ListRolePermissions(ctx context.Context, roleID string, activeOnly bool) ([]RolePermissionRecord, error) {
	var records []RolePermissionRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		query := db.Table(rolePermissionTable).Where("role_id = ?", roleID)
		if activeOnly {
			query = query.Where("active = ?", true)
		}
		return query.Find(&records).Error
	})
	return records, err
}

// CountRolePermissionsByKey 统计拥有该权限键的活跃角色数（分页 total 用）。
func (unit *Unit) CountRolePermissionsByKey(ctx context.Context, key string) (int64, error) {
	var count int64
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(rolePermissionTable).Where("permission_key = ? AND active = ?", key, true).Count(&count).Error
	})
	return count, err
}

// ListRolesByPermissionKey 返回拥有指定活跃权限键的角色（分页、按 code 稳定排序）；
// 供权限键影响分析（退役/审计时查看使用方）。
func (unit *Unit) ListRolesByPermissionKey(ctx context.Context, key string, offset, limit int) ([]RoleRecord, error) {
	var records []RoleRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(roleTable).
			Joins("JOIN "+rolePermissionTable+" rp ON rp.role_id = "+roleTable+".id").
			Where("rp.permission_key = ? AND rp.active = ?", key, true).
			Order(roleTable + ".code ASC").
			Offset(offset).Limit(limit).
			Find(&records).Error
	})
	return records, err
}

func (unit *Unit) ListActiveRolePermissions(ctx context.Context) ([]RolePermissionRecord, error) {
	var records []RolePermissionRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(rolePermissionTable).Where("active = ?", true).Find(&records).Error
	})
	return records, err
}

func (unit *Unit) UpdateRolePermission(ctx context.Context, roleID, key string, active bool, now time.Time) error {
	return unit.update(ctx, rolePermissionTable, "role_id = ? AND permission_key = ?", []any{roleID, key}, map[string]any{"active": active, "updated_at": now})
}

func (unit *Unit) CreateSession(ctx context.Context, value *SessionRecord) error {
	return unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(sessionTable).Create(value).Error })
}

func (unit *Unit) SessionByHash(ctx context.Context, hash []byte) (SessionRecord, error) {
	var record SessionRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(sessionTable).Where("id_hash = ?", hash).First(&record).Error
	})
	return record, err
}

func (unit *Unit) TouchSession(ctx context.Context, hash, csrf []byte, lastSeen, idle time.Time) error {
	values := map[string]any{}
	if csrf != nil {
		values["csrf_hash"] = csrf
	}
	if !lastSeen.IsZero() {
		values["last_seen_at"] = lastSeen
		values["idle_expires_at"] = idle
	}
	if len(values) == 0 {
		return database.ErrOperationFailed
	}
	return unit.update(ctx, sessionTable, "id_hash = ?", []any{hash}, values)
}

func (unit *Unit) RevokeSession(ctx context.Context, hash []byte, now time.Time) error {
	return unit.update(ctx, sessionTable, "id_hash = ?", []any{hash}, map[string]any{"revoked_at": &now})
}

func (unit *Unit) RevokeAccountSessions(ctx context.Context, accountID string, now time.Time) error {
	return unit.update(ctx, sessionTable, "account_id = ? AND revoked_at IS NULL", []any{accountID}, map[string]any{"revoked_at": &now})
}

// CountSessionsByAccount 统计账号会话数（分页 total 用）。activeOnly 表示
// 只统计未吊销且未过期（按 now）的会话；revokedOnly 表示只统计已吊销会话；
// 两者均为 false 时统计全部会话。
func (unit *Unit) CountSessionsByAccount(ctx context.Context, accountID string, now time.Time, activeOnly, revokedOnly bool) (int64, error) {
	var count int64
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		query := unit.sessionScope(ctx, db, accountID, now, activeOnly, revokedOnly)
		return query.Count(&count).Error
	})
	return count, err
}

// ListSessionsByAccount 返回账号会话的分页元数据（含已吊销标记），只暴露
// 摘要（IDHash hex）与过期信息，不泄露明文 SessionID。过滤语义与
// CountSessionsByAccount 一致，保证 total 与列表不漂移。
func (unit *Unit) ListSessionsByAccount(ctx context.Context, accountID string, now time.Time, activeOnly, revokedOnly bool, offset, limit int, sortValue string) ([]SessionRecord, error) {
	var records []SessionRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		query := unit.sessionScope(ctx, db, accountID, now, activeOnly, revokedOnly)
		order, err := listOrder(sortValue, map[string]string{"createdAt": "created_at", "lastSeenAt": "last_seen_at", "idleExpiresAt": "idle_expires_at"}, "created_at DESC, id_hash ASC")
		if err != nil {
			return err
		}
		return query.Order(order).Offset(offset).Limit(limit).Find(&records).Error
	})
	return records, err
}

// sessionScope 构造账号会话查询的公共过滤条件。
func (unit *Unit) sessionScope(ctx context.Context, db *gorm.DB, accountID string, now time.Time, activeOnly, revokedOnly bool) *gorm.DB {
	query := db.Table(sessionTable).Where("account_id = ?", accountID)
	if activeOnly {
		query = query.Where("revoked_at IS NULL AND idle_expires_at > ? AND absolute_expires_at > ?", now, now)
	}
	if revokedOnly {
		query = query.Where("revoked_at IS NOT NULL")
	}
	return query
}

// FindOldestActiveSession 返回账号按创建时间最早的 active 会话（077 会话上限
// 超限时用于「主动剔最旧」）；无匹配返回 ErrNotFound。
func (unit *Unit) FindOldestActiveSession(ctx context.Context, accountID string, now time.Time) (SessionRecord, error) {
	var record SessionRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		query := unit.sessionScope(ctx, db, accountID, now, true, false)
		return query.Order("created_at ASC, id_hash ASC").First(&record).Error
	})
	return record, err
}

// IdempotencyByKey 返回指定 operation/key 的已占用批量结果。
func (unit *Unit) IdempotencyByKey(ctx context.Context, operation, key string) (IdempotencyRecord, error) {
	var record IdempotencyRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(idempotencyTable).Where("operation = ? AND idempotency_key = ?", operation, key).First(&record).Error
	})
	return record, err
}

// CreateIdempotency 先占用 operation/key；唯一键保证并发请求只有一个执行者。
func (unit *Unit) CreateIdempotency(ctx context.Context, record *IdempotencyRecord) error {
	return unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(idempotencyTable).Create(record).Error })
}

// CompleteIdempotency 写入批量操作的完整稳定结果。
func (unit *Unit) CompleteIdempotency(ctx context.Context, operation, key, resultJSON string) error {
	return unit.update(ctx, idempotencyTable, "operation = ? AND idempotency_key = ?", []any{operation, key}, map[string]any{"result_json": resultJSON, "completed": true})
}

func (unit *Unit) update(ctx context.Context, table, condition string, arguments []any, values map[string]any) error {
	return unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(table).Where(condition, arguments...).Updates(values).Error
	})
}

// UserPreferencesByAccount 返回账号的偏好覆盖记录；未写入过返回 ErrNotFound。
func (unit *Unit) UserPreferencesByAccount(ctx context.Context, accountID string) (UserPreferenceRecord, error) {
	var record UserPreferenceRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(userPreferencesTable).Where("account_id = ?", accountID).First(&record).Error
	})
	return record, err
}

// UpsertUserPreferences 插入或覆盖账号的偏好 JSON（单行 upsert 语义）。
func (unit *Unit) UpsertUserPreferences(ctx context.Context, accountID, preferencesJSON string, now time.Time, expected ...uint64) error {
	if len(expected) > 0 {
		version := expected[0]
		if version == 0 {
			return unit.useDB(ctx, func(db *gorm.DB) error {
				return db.Table(userPreferencesTable).Create(&UserPreferenceRecord{AccountID: accountID, PreferencesJSON: preferencesJSON, UpdatedAt: now, Version: 1}).Error
			})
		}
		return unit.updateVersioned(ctx, userPreferencesTable, "account_id = ? AND version = ?", []any{accountID, version}, map[string]any{"preferences_json": preferencesJSON, "updated_at": now, "version": version + 1})
	}

	value := UserPreferenceRecord{Version: 1, AccountID: accountID, PreferencesJSON: preferencesJSON, UpdatedAt: now}
	return unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(userPreferencesTable).Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "account_id"}},
			DoUpdates: clause.Assignments(map[string]any{
				"preferences_json": value.PreferencesJSON, "updated_at": value.UpdatedAt, "version": gorm.Expr("version + ?", 1),
			}),
		}).Create(&value).Error
	})
}

func (unit *Unit) updateVersioned(ctx context.Context, table, condition string, arguments []any, values map[string]any) error {
	return unit.useDB(ctx, func(db *gorm.DB) error {
		result := db.Table(table).Where(condition, arguments...).Updates(values)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return database.ErrOptimisticConflict
		}
		return nil
	})
}

func (unit *Unit) updateApiToken(ctx context.Context, accountID, id string, values map[string]any, expected ...uint64) error {
	values["version"] = gorm.Expr("version + ?", 1)
	return unit.useDB(ctx, func(db *gorm.DB) error {
		query := db.Table(apiTokenTable).Where("id = ? AND account_id = ? AND revoked_at IS NULL", id, accountID)
		if len(expected) > 0 {
			query = query.Where("version = ?", expected[0])
		}
		result := query.Updates(values)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			if len(expected) > 0 {
				return database.ErrOptimisticConflict
			}
			return database.ErrNotFound
		}
		return nil
	})
}
