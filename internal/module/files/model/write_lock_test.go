package model

import (
	"errors"
	"testing"
)

func lockTree() []Entry {
	return []Entry{{ID: "folder", OwnerID: "owner", Name: "Folder", NormalizedName: "folder", Kind: Folder}, {ID: "file", OwnerID: "owner", ParentID: "folder", Name: "Note.txt", NormalizedName: "note.txt", Kind: File, ContentSHA: "abc", ContentRevision: 1}}
}

func TestWriteLockNamespaceAndDepth(t *testing.T) {
	entries := lockTree()
	lock := WriteLock{ID: "lock", ConnectionID: "editor", ConnectionRevision: 2, RootPath: "/folder", Depth: WriteLockDepthZero}
	content := entries[1]
	content.ContentRevision++
	if _, err := CheckWriteLocks(entries, []Entry{content}, []WriteLock{lock}, FileWriteAuthority{}); err != nil {
		t.Fatal("Depth0不应锁住成员内容", err)
	}
	member := entries[1]
	member.Name = "Renamed.txt"
	member.NormalizedName = "renamed.txt"
	if _, err := CheckWriteLocks(entries, []Entry{member}, []WriteLock{lock}, FileWriteAuthority{}); !errors.Is(err, ErrWriteLocked) {
		t.Fatal("Depth0遗漏直接成员改名", err)
	}
	lock.Depth = WriteLockDepthInfinity
	if _, err := CheckWriteLocks(entries, []Entry{content}, []WriteLock{lock}, FileWriteAuthority{}); !errors.Is(err, ErrWriteLocked) {
		t.Fatal("Infinity遗漏后代内容", err)
	}
	authority := FileWriteAuthority{ConnectionID: "editor", ConnectionRevision: 2, Tokens: []string{lock.Token()}}
	if _, err := CheckWriteLocks(entries, []Entry{content}, []WriteLock{lock}, authority); err != nil {
		t.Fatal("持锁主体无法写入", err)
	}
	authority.ConnectionRevision++
	if _, err := CheckWriteLocks(entries, []Entry{content}, []WriteLock{lock}, authority); !errors.Is(err, ErrWriteLocked) {
		t.Fatal("旧连接版本获得权限", err)
	}
}

func TestMoveDoesNotCarryLockAndProtectsBothNamespaces(t *testing.T) {
	entries := lockTree()
	lock := WriteLock{ID: "lock", ConnectionID: "editor", ConnectionRevision: 1, RootPath: "/folder/note.txt", Depth: WriteLockDepthZero}
	move := entries[0]
	move.Name = "Moved"
	move.NormalizedName = "moved"
	if _, err := CheckWriteLocks(entries, []Entry{move}, []WriteLock{lock}, FileWriteAuthority{}); !errors.Is(err, ErrWriteLocked) {
		t.Fatal("移动祖先绕过后代锁", err)
	}
	authority := FileWriteAuthority{ConnectionID: "editor", ConnectionRevision: 1, Tokens: []string{lock.Token()}}
	removed, err := CheckWriteLocks(entries, []Entry{move}, []WriteLock{lock}, authority)
	if err != nil || len(removed) != 1 || removed[0] != lock.ID {
		t.Fatal("MOVE应移除旧URL锁而非绑定条目ID", removed, err)
	}
	// 目标URL原先有锁，覆盖成另一个条目ID后仍需该锁。
	entries = append(entries, Entry{ID: "other", OwnerID: "owner", Name: "other", NormalizedName: "other", Kind: File})
	source := entries[2]
	source.ParentID = "folder"
	source.Name = "Note.txt"
	source.NormalizedName = "note.txt"
	trashed := entries[1]
	now := trashed.CreatedAt
	trashed.TrashedAt = &now
	removed, err = CheckWriteLocks(entries, []Entry{trashed, source}, []WriteLock{lock}, authority)
	if err != nil || len(removed) != 0 {
		t.Fatal("覆盖后仍映射的目标URL锁被误删", removed, err)
	}
}

func TestDAVIfSubmitsAllAppearingTokensAfterOverallMatch(t *testing.T) {
	entries := lockTree()
	lock := WriteLock{ID: "lock", ConnectionID: "editor", ConnectionRevision: 1, RootPath: "/folder/note.txt", Depth: WriteLockDepthZero}
	condition := DAVCondition{RequestPath: "/folder/note.txt", Lists: []DAVConditionList{
		{Conditions: []DAVStateCondition{{Not: true, Token: lock.Token()}}},
		{Conditions: []DAVStateCondition{{ETag: `W/"abc"`}}},
	}}
	authority, matched, err := EvaluateDAVCondition(entries, []WriteLock{lock}, condition, "editor", 1)
	if err != nil || !matched || !authority.Allows(lock) {
		t.Fatal("已成立If中的Not分支令牌也应视为提交", matched, err)
	}
	condition.Lists = condition.Lists[:1]
	_, matched, err = EvaluateDAVCondition(entries, []WriteLock{lock}, condition, "editor", 1)
	if err != nil || matched {
		t.Fatal("Not有效令牌条件应为假", matched, err)
	}
	condition.Lists = []DAVConditionList{{Resource: "/missing", Conditions: []DAVStateCondition{{Not: true, ETag: `"abc"`}}}}
	_, matched, err = EvaluateDAVCondition(entries, []WriteLock{lock}, condition, "editor", 1)
	if err != nil || !matched {
		t.Fatal("未映射资源不应有ETag", matched, err)
	}
}
