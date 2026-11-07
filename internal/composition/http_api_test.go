package composition

import (
	"strings"
	"testing"

	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
)

func TestApplicationHTTPRegistrationsAreComplete(t *testing.T) {
	blueprint, err := newApplicationBlueprint()
	if err != nil {
		t.Fatal(err)
	}
	definitions := blueprint.httpDefinitions
	if len(definitions) != 174 {
		t.Fatalf("operation count = %d", len(definitions))
	}
	seen := make(map[string]struct{}, len(definitions))
	downloads := map[string]string{
		"files.torrents.capabilities": "files:read", "files.torrents.create": "files:write", "files.torrents.read": "files:read", "files.torrents.select": "files:write",
		"files.write-locks.list": "files:read", "files.write-locks.release": "files:write",
		"files.preferences.history.read": "files:read", "files.preferences.history.save": "files:write",
		"files.preferences.read": "files:read", "files.preferences.save": "files:write",
		"files.access.read": "files:read", "files.access.update": "files:write", "files.access.preview": "files:read", "files.audience.lookup": "files:write",
		"files.archive.inspect": "files:read", "files.archive.member": "files:read", "files.archive.download": "files:read", "files.archive.extract": "files:write",
		"files.archive-tasks.create": "files:write", "files.archive-tasks.list": "files:read", "files.archive-tasks.read": "files:read", "files.archive-tasks.cancel": "files:write", "files.archive-tasks.remove": "files:write",
		"files.downloads.create": "files:write", "files.downloads.list": "files:read", "files.downloads.read": "files:read", "files.downloads.source": "files:read",
		"files.downloads.pause": "files:write", "files.downloads.resume": "files:write", "files.downloads.retry": "files:write", "files.downloads.cancel": "files:write",
		"files.downloads.restart": "files:write", "files.downloads.target": "files:write", "files.downloads.remove": "files:write", "files.downloads.batch-create": "files:write", "files.downloads.batch-control": "files:write",
	}
	for _, definition := range definitions {
		if strings.HasPrefix(definition.ID, "files.public.") {
			if definition.Security != humabinding.SecurityNone || definition.Policy != humabinding.PolicyPublic || definition.Scope != "" || definition.Action != "" {
				t.Fatalf("public sharing policy is not isolated: %s", definition.ID)
			}
			continue
		}
		seen[definition.ID] = struct{}{}
		if scope, exists := downloads[definition.ID]; exists {
			if definition.Scope != scope || definition.Policy != humabinding.PolicyProtected || definition.Action != definition.ID {
				t.Fatalf("离线任务权限不完整: %s", definition.ID)
			}
			delete(downloads, definition.ID)
		}
	}
	if len(downloads) != 0 {
		t.Fatalf("缺少离线任务入口: %v", downloads)
	}
	for _, id := range []string{"files.list", "files.folder", "files.text.create", "files.transfers.create", "files.transfers.chunk", "files.transfers.commit", "files.detail", "files.update", "files.trash", "files.restore", "files.content", "iam.setup", "navigation.menus.update", "organization.departments.update", "completeTodo", "auth.audit.list", "auth.audit.read", "iam.sessions.list", "iam.sessions.revoke", "iam.accounts.read", "iam.accounts.update", "iam.accounts.archive", "iam.roles.read", "iam.roles.update", "iam.roles.archive", "iam.self.profile.update", "iam.self.archive", "iam.self.archive.confirm", "iam.roles.accounts.list", "iam.permissions.roles.list", "iam.api-tokens.list", "iam.api-tokens.create", "iam.api-tokens.update", "iam.api-tokens.rotate", "iam.api-tokens.disable", "iam.api-tokens.enable", "iam.api-tokens.revoke", "iam.self.mfa.begin", "iam.self.mfa.status", "iam.self.mfa.confirm", "iam.self.mfa.disable", "iam.login.mfa-verify", "iam.accounts.status.batch", "iam.accounts.archive.batch"} {
		if _, ok := seen[id]; !ok {
			t.Fatalf("missing operation %q", id)
		}
	}
	// 076：Organization 全部 operation 必须使用 webuiSession 认证 profile（与
	// IAM/Navigation/Auth 一致），保证托管模式下 org 页面经 Session 闭环可达。
	for _, definition := range definitions {
		if (strings.HasPrefix(definition.ID, "organization.") || strings.HasPrefix(definition.ID, "files.") && !strings.HasPrefix(definition.ID, "files.public.")) && definition.Security != humabinding.SecurityWebUISession {
			t.Fatalf("organization operation %q security = %q, want webuiSession", definition.ID, definition.Security)
		}
	}
}

func TestApplicationBlueprintReturnsIndependentPolicyCopies(t *testing.T) {
	blueprint, err := newApplicationBlueprint()
	if err != nil {
		t.Fatal(err)
	}
	first := blueprint.policyCopy()
	first[0].Operation = "mutated"
	second := blueprint.policyCopy()
	if second[0].Operation == "mutated" {
		t.Fatal("blueprint policy slice is mutable through its consumer copy")
	}
}
