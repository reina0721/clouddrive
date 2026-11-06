package service_test

import (
	"crypto/sha256"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/iam/model"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	"github.com/reina0721/clouddrive/internal/module/iam/service"
)

func TestSessionPasswordVerificationPreservesSessionAndSharesFailureBudget(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	session, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	store := storeForResource(t, resource)
	hash := sha256.Sum256([]byte(session.ID))
	var before, after repo.SessionRecord
	read := func(target *repo.SessionRecord) {
		t.Helper()
		if err := store.Use(t.Context(), func(r *repo.Unit) error {
			var err error
			*target, err = r.SessionByHash(t.Context(), hash[:])
			return err
		}); err != nil {
			t.Fatal(err)
		}
	}
	read(&before)
	if err := iam.VerifySessionPassword(t.Context(), session.ID, "incorrect"); !errors.Is(err, service.ErrInvalidCredentials) {
		t.Fatalf("错误密码没有失败: %v", err)
	}
	if _, err := iam.Resolve(t.Context(), session.ID); err != nil {
		t.Fatalf("输错一次丢失会话: %v", err)
	}
	if err := iam.VerifySessionPassword(t.Context(), session.ID, "123456789012345"); err != nil {
		t.Fatal(err)
	}
	read(&after)
	if !reflect.DeepEqual(before, after) {
		t.Fatal("复核改写了会话、MFA或期限")
	}
	// 成功重置先前失败；登录与复核合计三次错误才达到同一持久预算。
	if _, err := iam.Login(t.Context(), "owner", "incorrect"); !errors.Is(err, service.ErrInvalidCredentials) {
		t.Fatal(err)
	}
	if err := iam.VerifySessionPassword(t.Context(), session.ID, "incorrect"); !errors.Is(err, service.ErrInvalidCredentials) {
		t.Fatal(err)
	}
	if err := iam.VerifySessionPassword(t.Context(), session.ID, "incorrect"); !errors.Is(err, service.ErrAccountLocked) {
		t.Fatalf("未累计共享预算: %v", err)
	}
	if err := iam.VerifySessionPassword(t.Context(), session.ID, "123456789012345"); !errors.Is(err, service.ErrAccountLocked) {
		t.Fatalf("正确密码绕过锁定期: %v", err)
	}
}

func TestSessionPasswordVerificationRejectsInvalidSessionAndInputs(t *testing.T) {
	for _, scenario := range []string{"empty", "long", "missing", "revoked", "expired", "revision", "disabled", "must-change"} {
		t.Run(scenario, func(t *testing.T) {
			iam, resource := newService(t)
			defer resource.Close()
			session, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
			if err != nil {
				t.Fatal(err)
			}
			store := storeForResource(t, resource)
			password, sessionID := "123456789012345", session.ID
			want := service.ErrSessionInvalid
			switch scenario {
			case "empty":
				password = ""
				want = model.ErrInvalidPassword
			case "long":
				password = strings.Repeat("长", 129)
				want = model.ErrInvalidPassword
			case "missing":
				sessionID = ""
			case "revoked":
				if err := iam.Logout(t.Context(), session.ID); err != nil {
					t.Fatal(err)
				}
			case "expired":
				hash := sha256.Sum256([]byte(session.ID))
				past := session.CreatedAt.Add(-time.Hour)
				if err := store.Use(t.Context(), func(r *repo.Unit) error { return r.TouchSession(t.Context(), hash[:], nil, past, past) }); err != nil {
					t.Fatal(err)
				}
			default:
				if err := store.Use(t.Context(), func(r *repo.Unit) error {
					account, err := r.AccountByID(t.Context(), session.Identity.AccountID)
					if err != nil {
						return err
					}
					changes := repo.AccountChanges{UpdatedAt: account.UpdatedAt}
					if scenario == "revision" {
						revision := account.SecurityRevision + 1
						changes.SecurityRevision = &revision
					}
					if scenario == "disabled" {
						status := string(model.AccountDisabled)
						changes.Status = &status
					}
					if scenario == "must-change" {
						required := true
						changes.MustChangePassword = &required
						want = service.ErrAccountDisabled
					}
					return r.UpdateAccount(t.Context(), account.ID, account.Version, changes)
				}); err != nil {
					t.Fatal(err)
				}
			}
			if err := iam.VerifySessionPassword(t.Context(), sessionID, password); !errors.Is(err, want) {
				t.Fatalf("场景%s返回非预期错误: %v", scenario, err)
			}
		})
	}
}
