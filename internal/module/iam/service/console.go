package service

import (
	"context"
	"errors"
	"github.com/reina0721/clouddrive/internal/module/iam/model"
	iampermission "github.com/reina0721/clouddrive/internal/module/iam/permission"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	"strings"
)

var ErrRegistrationClosed = errors.New("public registration is disabled")

// RequireConsolePermission 在每次任务执行前读取账号状态和当前权限。
func (s *Service) RequireConsolePermission(ctx context.Context, id string, key permissioncatalog.Key) error {
	account, err := s.accountByID(ctx, id)
	if err != nil {
		return err
	}
	if account.Archived || account.Status != "active" || account.MustChangePassword {
		return ErrAccountDisabled
	}
	keys, err := s.creatorOwnedPermissions(ctx, id)
	if err != nil {
		return err
	}
	if _, ok := keys[key]; !ok {
		return ErrAccountDisabled
	}
	return nil
}

// Registration 返回服务端注册策略，调用方不能用前端配置取代它。
func (s *Service) Registration(ctx context.Context) (repo.RegistrationSettings, error) {
	var result repo.RegistrationSettings
	err := s.store.Use(ctx, func(r *repo.Unit) error { var err error; result, err = r.Registration(ctx); return err })
	return result, err
}

// WriteConsoleRole 原子更新名称与权限，防止分次写入留下半完成角色。
func (s *Service) WriteConsoleRole(ctx context.Context, id string, version uint64, name string, keys []permissioncatalog.Key) (string, error) {
	name, err := model.NormalizeName(name)
	if err != nil {
		return "", err
	}
	for _, key := range keys {
		if _, ok := s.catalog.Lookup(key); !ok {
			return "", ErrUnknownPermission
		}
	}
	create := id == ""
	if create {
		id, err = s.ids.New()
		if err != nil {
			return "", err
		}
	}
	err = s.authorizeMutation(ctx, func(txCtx context.Context, r *repo.Unit) (bool, error) {
		now := s.clock.Now().UTC()
		if create {
			role, e := model.NewRole(id, "console-"+strings.ReplaceAll(id, "-", ""), name, "", false, now)
			if e != nil {
				return false, e
			}
			record := roleRecord(role)
			if e = r.CreateRole(txCtx, &record); e != nil {
				return false, e
			}
		} else {
			role, e := r.RoleByID(txCtx, id)
			if e != nil {
				return false, e
			}
			if role.System {
				return false, ErrImmutableOwner
			}
			if role.Version != version {
				return false, ErrVersionConflict
			}
			if role.Archived {
				return false, repo.ErrNotFound
			}
			if e = r.UpdateRoleInfo(txCtx, id, version, repo.RoleChanges{Name: &name, UpdatedAt: now}); e != nil {
				return false, e
			}
		}
		existing, e := r.ListRolePermissions(txCtx, id, false)
		if e != nil {
			return false, e
		}
		seen := map[permissioncatalog.Key]bool{}
		next := map[permissioncatalog.Key]bool{}
		for _, key := range keys {
			next[key] = true
		}
		for _, entry := range existing {
			key := permissioncatalog.Key(entry.PermissionKey)
			seen[key] = true
			if e = r.UpdateRolePermission(txCtx, id, entry.PermissionKey, next[key], now); e != nil {
				return false, e
			}
		}
		for key := range next {
			if !seen[key] {
				if e = r.CreateRolePermission(txCtx, &repo.RolePermissionRecord{RoleID: id, PermissionKey: string(key), Active: true, UpdatedAt: now}); e != nil {
					return false, e
				}
			}
		}
		if !create {
			if e = s.touchAssignedAccounts(txCtx, r, id, now); e != nil {
				return false, e
			}
		}
		return true, nil
	}, nil)
	operation := "iam.roles.update"
	if create {
		operation = "iam.roles.create"
	}
	s.auditOperation(ctx, operation, "update", "role", id, err)
	return id, err
}

// UpdateRegistration 限制公开注册默认角色不能含管理权限或系统所有者身份。
func (s *Service) UpdateRegistration(ctx context.Context, value repo.RegistrationSettings) error {
	return s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		if value.DefaultRoleID != "" {
			if err := s.registrationRole(txCtx, r, value.DefaultRoleID); err != nil {
				return err
			}
		}
		if value.Enabled && value.DefaultRoleID == "" {
			return model.ErrInvalidID
		}
		value.UpdatedAt = s.clock.Now().UTC()
		return r.UpdateRegistration(txCtx, value)
	})
}

func (s *Service) registrationRole(ctx context.Context, r *repo.Unit, id string) error {
	role, err := r.RoleByID(ctx, id)
	if err != nil {
		return err
	}
	if role.System || role.Archived || !role.Active {
		return ErrImmutableOwner
	}
	permissions, err := r.ListRolePermissions(ctx, id, true)
	if err != nil {
		return err
	}
	for _, p := range permissions {
		definition, ok := s.catalog.Lookup(permissioncatalog.Key(p.PermissionKey))
		if !ok || (definition.Risk != "standard" && definition.Key != iampermission.SelfPasswordWrite && definition.Key != iampermission.SelfArchive) {
			return ErrImmutableOwner
		}
	}
	return nil
}

// CreateConsoleAccount 在同一事务创建凭据与角色；公开注册在事务内重读策略。
func (s *Service) CreateConsoleAccount(ctx context.Context, username, name, password string, roleIDs []string, status model.AccountStatus, public bool) (model.Account, error) {
	if err := model.ValidatePasswordWith(password, s.config.PasswordPolicy); err != nil {
		return model.Account{}, err
	}
	if status != model.AccountActive && status != model.AccountDisabled {
		return model.Account{}, model.ErrInvalidName
	}
	hash, err := s.passwords.Hash(password)
	if err != nil {
		return model.Account{}, err
	}
	id, err := s.ids.New()
	if err != nil {
		return model.Account{}, err
	}
	now := s.clock.Now().UTC()
	account, err := model.NewAccount(id, username, name, false, now)
	if err != nil {
		return model.Account{}, err
	}
	account.Status = status
	account.Version = 1
	err = s.authorizeMutation(ctx, func(txCtx context.Context, r *repo.Unit) (bool, error) {
		if public {
			policy, e := r.Registration(txCtx)
			if e != nil {
				return false, e
			}
			if !policy.Enabled {
				return false, ErrRegistrationClosed
			}
			if e = s.registrationRole(txCtx, r, policy.DefaultRoleID); e != nil {
				return false, e
			}
			roleIDs = []string{policy.DefaultRoleID}
		}
		if len(roleIDs) < 1 || len(roleIDs) > 20 {
			return false, model.ErrInvalidID
		}
		for roleID := range set(roleIDs) {
			role, e := r.RoleByID(txCtx, roleID)
			if e != nil {
				return false, e
			}
			if role.Archived || !role.Active {
				return false, ErrAccountDisabled
			}
		}
		record := accountRecord(account)
		if e := r.CreateAccount(txCtx, &record); e != nil {
			return false, e
		}
		if e := r.CreateCredential(txCtx, &repo.CredentialRecord{AccountID: id, PasswordHash: hash, UpdatedAt: now, PasswordChangedAt: now}); e != nil {
			return false, e
		}
		if e := s.recordPasswordHistory(txCtx, r, id, hash, now); e != nil {
			return false, e
		}
		for roleID := range set(roleIDs) {
			if e := r.CreateAccountRole(txCtx, &repo.AccountRoleRecord{AccountID: id, RoleID: roleID, Active: true, UpdatedAt: now}); e != nil {
				return false, e
			}
		}
		return true, nil
	}, nil)
	s.auditOperation(ctx, "iam.accounts.create", "create", "account", id, err)
	return account, err
}

// UpdateConsoleProfile 使用账号版本更新姓名与登录标识；不修改角色和凭据。
func (s *Service) UpdateConsoleProfile(ctx context.Context, id string, version uint64, name, username string) error {
	name, err := model.NormalizeName(name)
	if err != nil {
		return err
	}
	username, err = model.NormalizeUsername(username)
	if err != nil {
		return err
	}
	return s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		account, e := accountByID(txCtx, r, id)
		if e != nil {
			return e
		}
		if account.Archived {
			return ErrAccountDisabled
		}
		if account.Version != version {
			return ErrVersionConflict
		}
		return r.UpdateAccount(txCtx, id, version, repo.AccountChanges{DisplayName: &name, Username: &username, UpdatedAt: s.clock.Now().UTC()})
	})
}
