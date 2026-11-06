package model

import (
	"errors"
	"testing"
)

const (
	accessOwnerID     = "5eb73070-6358-44a2-a3a5-aeb781e17fc1"
	accessUserID      = "00df8a0d-12f7-47d9-99bd-5823396564e6"
	accessRoleID      = "4d83d204-0877-49c6-92bf-a8482e6f8fc8"
	accessOtherRoleID = "8959bde8-cf31-4b20-a01f-d8e081a335bd"
)

func accessFixture() ([]Entry, Share) {
	return []Entry{{ID: "root", Kind: Folder}, {ID: "folder", ParentID: "root", Kind: Folder}, {ID: "leaf", ParentID: "folder", Kind: File}, {ID: "outside", Kind: File}}, Share{OwnerID: accessOwnerID, RootID: "root", Permissions: ShareReadOnly}
}

func permissionPointer(value SharePermission) *SharePermission { return &value }

// TestAudiencePrecedence 验证真实业务顺序，不把管理员或精确拒绝混入普通角色合并。
func TestAudiencePrecedence(t *testing.T) {
	entries, share := accessFixture()
	share.Audience = AudiencePolicy{Anonymous: permissionPointer(0), Authenticated: permissionPointer(ShareReadOnly), Accounts: []AudienceRule{{SubjectID: accessUserID, Permissions: ShareUploadOnly}}, Roles: []AudienceRule{{SubjectID: accessRoleID, Permissions: ShareReadOnly}, {SubjectID: accessOtherRoleID, Permissions: 0}}}
	for _, scenario := range []struct {
		name   string
		viewer ShareViewer
		want   SharePermission
		reason AccessReason
	}{
		{"匿名拒绝", ShareViewer{}, 0, AccessAnonymous},
		{"登录默认", ShareViewer{AccountID: "other"}, ShareReadOnly, AccessAuthenticated},
		{"账号优先于拒绝角色", ShareViewer{AccountID: accessUserID, RoleIDs: []string{accessOtherRoleID}}, ShareUploadOnly, AccessAccount},
		{"角色允许", ShareViewer{AccountID: "other", RoleIDs: []string{accessRoleID}}, ShareReadOnly, AccessRole},
		{"角色拒绝优先", ShareViewer{AccountID: "other", RoleIDs: []string{accessRoleID, accessOtherRoleID}}, 0, AccessRole},
		{"拥有者", ShareViewer{AccountID: accessOwnerID}, ShareEditor, AccessOwner},
		{"管理员", ShareViewer{AccountID: "admin", Administrator: true}, ShareEditor, AccessAdministrator},
		{"匿名不能伪造管理员", ShareViewer{Administrator: true}, 0, AccessAnonymous},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			decision, err := EffectiveAccess(entries, share, "leaf", scenario.viewer)
			if err != nil {
				t.Fatal(err)
			}
			if decision.Permissions != scenario.want || decision.Reason != scenario.reason {
				t.Fatal("受众优先级或能力不符")
			}
		})
	}
	share.Audience.Accounts[0].Permissions = 0
	decision, err := EffectiveAccess(entries, share, "leaf", ShareViewer{AccountID: accessUserID, RoleIDs: []string{accessRoleID}})
	if err != nil || decision.Permissions != 0 || decision.Reason != AccessAccount {
		t.Fatal("精确账号拒绝未覆盖允许角色")
	}
	share.Audience.Accounts = nil
	share.Audience.Roles[1].Permissions = ShareUploadOnly
	decision, err = EffectiveAccess(entries, share, "leaf", ShareViewer{AccountID: accessUserID, RoleIDs: []string{accessRoleID, accessOtherRoleID}})
	if err != nil || decision.Permissions != ShareReadOnly|ShareUploadOnly {
		t.Fatal("角色能力没有合并")
	}
}

// TestAccessInheritance 验证最近策略替换、分享根覆盖和搜索可达性是不同事实。
func TestAccessInheritance(t *testing.T) {
	entries, share := accessFixture()
	entries[0].AccessPolicy = &AccessPolicy{Default: 0}
	entries[1].AccessPolicy = &AccessPolicy{Default: ShareUploadOnly}
	resolver, err := NewShareAccessResolver(entries, share, ShareViewer{})
	if err != nil {
		t.Fatal(err)
	}
	root, err := resolver.Decision("root")
	if err != nil || root.Permissions != ShareReadOnly {
		t.Fatal("分享根错误使用文件策略")
	}
	leaf, err := resolver.Decision("leaf")
	if err != nil || leaf.Permissions != ShareUploadOnly || leaf.SourceEntryID != "folder" {
		t.Fatal("未继承最近独立策略")
	}
	entries[2].AccessPolicy = &AccessPolicy{Default: ShareReadOnly}
	resolver, err = NewShareAccessResolver(entries, share, ShareViewer{})
	if err != nil {
		t.Fatal(err)
	}
	leaf, err = resolver.Decision("leaf")
	if err != nil || leaf.Permissions != ShareReadOnly || leaf.SourceEntryID != "leaf" {
		t.Fatal("子项策略未替换祖先")
	}
	visible, err := resolver.Discoverable("leaf")
	if err != nil || visible {
		t.Fatal("搜索越过无浏览权限的祖先")
	}
	entries[1].AccessPolicy = nil
	resolver, err = NewShareAccessResolver(entries, share, ShareViewer{})
	if err != nil {
		t.Fatal(err)
	}
	visible, err = resolver.Discoverable("leaf")
	if err != nil || !visible {
		t.Fatal("恢复继承错误清除或遮蔽后代策略")
	}
	if _, err := resolver.Decision("outside"); !errors.Is(err, ErrMissing) {
		t.Fatal("授予了分享之外的目标")
	}
}

func TestAudienceValidationAndClone(t *testing.T) {
	valid := AudiencePolicy{Anonymous: permissionPointer(0), Accounts: []AudienceRule{{SubjectID: accessUserID, Permissions: ShareReadOnly}}}
	if err := valid.Validate(); err != nil {
		t.Fatal(err)
	}
	copy := CloneAudience(valid)
	*copy.Anonymous = ShareEditor
	copy.Accounts[0].Permissions = 0
	if *valid.Anonymous != 0 || valid.Accounts[0].Permissions != ShareReadOnly {
		t.Fatal("策略副本共享了可变状态")
	}
	for _, invalid := range []AudiencePolicy{
		{Anonymous: permissionPointer(1 << 15)},
		{Authenticated: permissionPointer(ShareModify)},
		{Accounts: []AudienceRule{{SubjectID: "", Permissions: ShareReadOnly}}},
		{Accounts: []AudienceRule{{SubjectID: accessUserID, Permissions: 0}, {SubjectID: accessUserID, Permissions: ShareReadOnly}}},
		{Roles: make([]AudienceRule, MaxAudienceRules+1)},
	} {
		if err := invalid.Validate(); err == nil {
			t.Fatal("非法策略被接受")
		}
	}
	if err := (&AccessPolicy{Default: 0}).Validate(); err != nil {
		t.Fatal("显式拒绝被误当成缺失")
	}
}

func TestAccessTreeCyclesAndRootVisibility(t *testing.T) {
	entries, share := accessFixture()
	entries[1].ParentID = "leaf"
	entries[2].Kind = Folder
	resolver, err := NewShareAccessResolver(entries, share, ShareViewer{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := resolver.Decision("leaf"); !errors.Is(err, ErrInvalid) {
		t.Fatal("目录环未拒绝")
	}
	entries, share = accessFixture()
	entries[0].ParentID = "missing"
	if _, err := NewShareAccessResolver(entries, share, ShareViewer{}); !errors.Is(err, ErrMissing) {
		t.Fatal("分享根绕过缺失祖先")
	}
}
