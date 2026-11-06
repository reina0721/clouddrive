package composition

import (
	"errors"
	"testing"
	"time"

	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	filesmodel "github.com/reina0721/clouddrive/internal/module/files/model"
)

// TestShareAudienceRejectsRestrictedSessionPrincipal 覆盖口令到期只派生会话限制、原始账号标记尚未改变的边界。
func TestShareAudienceRejectsRestrictedSessionPrincipal(t *testing.T) {
	now := time.Now().UTC()
	principal, err := authmodel.NewIAMRBACPrincipal("d25f5cc7-8a0d-4483-9764-7b70580a39fc", authmodel.ActorService, 1, true, now, now)
	if err != nil {
		t.Fatal(err)
	}
	// 受限主体必须在目录读取前拒绝，不能被当作匿名或普通已登录受众。
	viewer, err := (filesConnectionAuthority{}).ShareViewer(authmodel.WithPrincipal(t.Context(), principal))
	if !errors.Is(err, filesmodel.ErrShareForbidden) || viewer.AccountID != "" {
		t.Fatal("受限IAM会话未在分享受众边界拒绝")
	}
}
