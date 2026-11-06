package service

import (
	"context"
	"time"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/iam/model"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
)

// VerifySessionPassword 只复核当前有效会话的本人密码，不创建会话、提升认证等级或签发授权凭据。
// 错误密码共享登录失败预算；业务错误在事务提交后返回，避免回滚持久失败计数。
func (s *Service) VerifySessionPassword(ctx context.Context, sessionID, password string) error {
	if password == "" || !utf8.ValidString(password) || utf8.RuneCountInString(password) > model.MaxPasswordRunes {
		return model.ErrInvalidPassword
	}
	if sessionID == "" {
		return ErrSessionInvalid
	}
	var outcome error
	err := s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		now := s.clock.Now().UTC()
		session, err := r.SessionByHash(txCtx, digest(sessionID))
		if err != nil {
			if repo.IsNotFound(err) {
				return ErrSessionInvalid
			}
			return err
		}
		if session.RevokedAt != nil || !now.Before(session.IdleExpiresAt) || !now.Before(session.AbsoluteExpiresAt) {
			return ErrSessionInvalid
		}
		account, err := r.AccountByID(txCtx, session.AccountID)
		if err != nil {
			if repo.IsNotFound(err) {
				return ErrSessionInvalid
			}
			return err
		}
		if account.Archived || account.Status != string(model.AccountActive) || account.SecurityRevision != session.SecurityRevision {
			return ErrSessionInvalid
		}
		credential, err := r.CredentialByAccount(txCtx, account.ID)
		if err != nil {
			if repo.IsNotFound(err) {
				return ErrSessionInvalid
			}
			return err
		}
		if account.MustChangePassword || s.passwordExpired(now, credential.PasswordChangedAt) {
			return ErrAccountDisabled
		}
		if account.LockedUntil != nil && now.Before(*account.LockedUntil) {
			return ErrAccountLocked
		}
		verification, err := s.passwords.Verify(credential.PasswordHash, password)
		if err != nil {
			return credentialVerificationError(err)
		}
		attempts := 0
		var locked *time.Time
		if !verification.Match {
			attempts = account.FailedAttempts + 1
			outcome = ErrInvalidCredentials
			if attempts >= s.config.MaxFailedAttempts {
				until := now.Add(s.config.LockDuration)
				locked = &until
				attempts = 0
				outcome = ErrAccountLocked
			}
		}
		// 不改凭据或会话；版本CAS保证并发错误不会以成功覆盖另一请求的计数。
		return r.UpdateAccount(txCtx, account.ID, account.Version, repo.AccountChanges{FailedAttempts: &attempts, LockedUntil: &locked, UpdatedAt: now})
	})
	if err != nil {
		return err
	}
	return outcome
}
