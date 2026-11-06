package composition

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/reina0721/clouddrive/internal/module/auth"
	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	filesmodel "github.com/reina0721/clouddrive/internal/module/files/model"
	filesservice "github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/module/iam"
	iamservice "github.com/reina0721/clouddrive/internal/module/iam/service"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

func fileAudienceError(err error) error {
	if errors.Is(err, iam.ErrAudienceUnavailable) {
		return errors.Join(filesmodel.ErrMissing, err)
	}
	return err
}

func (a filesConnectionAuthority) AudienceAccount(ctx context.Context, id string) (filesmodel.ShareViewer, error) {
	if a.audience == nil {
		return filesmodel.ShareViewer{}, fmt.Errorf("file audience authority unavailable")
	}
	identity, err := a.audience.AudienceAccount(ctx, id)
	if err != nil {
		return filesmodel.ShareViewer{}, fileAudienceError(err)
	}
	return filesmodel.ShareViewer{AccountID: identity.ID, RoleIDs: identity.RoleIDs, Administrator: identity.Administrator}, nil
}

func (a filesConnectionAuthority) ShareViewer(ctx context.Context) (filesmodel.ShareViewer, error) {
	principal, ok := authmodel.PrincipalFromContext(ctx)
	if !ok {
		return filesmodel.ShareViewer{}, nil
	}
	// IAM可能仅在会话解析时派生口令到期限制，不能只检查账号持久标记。
	if principal.Restricted {
		return filesmodel.ShareViewer{}, errors.Join(filesmodel.ErrShareForbidden, authmodel.ErrPermissionDenied)
	}
	viewer, err := a.AudienceAccount(ctx, principal.Subject)
	if errors.Is(err, filesmodel.ErrMissing) {
		return filesmodel.ShareViewer{}, errors.Join(filesmodel.ErrShareForbidden, err)
	}
	return viewer, err
}

func (a filesConnectionAuthority) AudienceTarget(ctx context.Context, kind filesservice.AudienceKind, id string) (filesservice.AudienceTarget, error) {
	if a.audience == nil {
		return filesservice.AudienceTarget{}, fmt.Errorf("file audience directory unavailable")
	}
	var target iam.AudienceTarget
	var err error
	switch kind {
	case filesservice.AudienceAccount:
		var identity iam.AudienceIdentity
		identity, err = a.audience.AudienceAccount(ctx, id)
		target = identity.AudienceTarget
	case filesservice.AudienceRole:
		target, err = a.audience.AudienceRole(ctx, id)
	default:
		return filesservice.AudienceTarget{}, filesmodel.ErrInvalid
	}
	if err != nil {
		return filesservice.AudienceTarget{}, fileAudienceError(err)
	}
	return filesservice.AudienceTarget{ID: target.ID, Label: target.Label}, nil
}

func (a filesConnectionAuthority) FindAudienceTarget(ctx context.Context, kind filesservice.AudienceKind, key string) (filesservice.AudienceTarget, error) {
	if a.audience == nil {
		return filesservice.AudienceTarget{}, fmt.Errorf("file audience directory unavailable")
	}
	var target iam.AudienceTarget
	var err error
	switch kind {
	case filesservice.AudienceAccount:
		target, err = a.audience.FindAudienceAccount(ctx, key)
	case filesservice.AudienceRole:
		target, err = a.audience.FindAudienceRole(ctx, key)
	default:
		return filesservice.AudienceTarget{}, filesmodel.ErrInvalid
	}
	if err != nil {
		return filesservice.AudienceTarget{}, fileAudienceError(err)
	}
	return filesservice.AudienceTarget{ID: target.ID, Label: target.Label}, nil
}

type fileOptionalSessionAuth struct{ session auth.RequestAuthenticator }

func (a fileOptionalSessionAuth) AuthenticateOptional(request *http.Request) (*http.Request, error) {
	_, err := request.Cookie(iamservice.SessionCookieName)
	if errors.Is(err, http.ErrNoCookie) {
		return request, nil
	}
	if err != nil {
		return nil, &httpx.StatusError{StatusCode: http.StatusUnauthorized, Code: "unauthenticated", Err: err}
	}
	authenticated, err := a.session.AuthenticateRequest(request)
	if err != nil {
		if errors.Is(err, iamservice.ErrSessionInvalid) || errors.Is(err, iamservice.ErrAccountDisabled) || errors.Is(err, iamservice.ErrAccountLocked) {
			return nil, &httpx.StatusError{StatusCode: http.StatusUnauthorized, Code: "unauthenticated", Err: err}
		}
		return nil, err
	}
	return authenticated, nil
}
