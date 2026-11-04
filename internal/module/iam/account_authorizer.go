package iam

import (
	"context"
	"errors"

	"github.com/reina0721/clouddrive/internal/module/iam/authorization"
	"github.com/reina0721/clouddrive/internal/module/iam/model"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
)

// accountAuthorizer 使用当前IAM事实，不能把创建凭据时的权限永久缓存为授权。
type accountAuthorizer struct {
	store   *repo.Store
	runtime *authorization.Runtime
}

func (a accountAuthorizer) AuthorizeAccount(ctx context.Context, accountID string, permission permissioncatalog.Key) (bool, error) {
	if accountID == "" || permission == "" {
		return false, nil
	}
	var revision uint64
	enabled := false
	err := a.store.WithinTx(ctx, func(ctx context.Context, unit *repo.Unit) error {
		account, err := unit.AccountByID(ctx, accountID)
		if errors.Is(err, repo.ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if account.Archived || account.Status != string(model.AccountActive) || account.MustChangePassword {
			return nil
		}
		revision, err = unit.CurrentAuthorizationRevision(ctx)
		if err != nil {
			return err
		}
		enabled = true
		return nil
	})
	if err != nil || !enabled {
		return false, err
	}
	decision, err := a.runtime.Decide(ctx, authorization.Request{Subject: accountID, Permission: permission, Revision: revision})
	return decision.Allowed, err
}
