package model

// ShareAccessResolver 只拥有一次不可变目录快照的索引和结果缓存，不跨请求缓存身份或权限。
type ShareAccessResolver struct {
	entries   map[string]Entry
	share     Share
	viewer    ShareViewer
	decisions map[string]AccessDecision
	discovery map[string]bool
}

// NewShareAccessResolver 校验请求快照并建立只属于本次求值的索引。
func NewShareAccessResolver(entries []Entry, share Share, viewer ShareViewer) (*ShareAccessResolver, error) {
	if err := share.Audience.Validate(); err != nil {
		return nil, err
	}
	resolver := &ShareAccessResolver{entries: make(map[string]Entry, len(entries)), share: share, viewer: viewer, decisions: map[string]AccessDecision{}, discovery: map[string]bool{}}
	for _, entry := range entries {
		if _, duplicate := resolver.entries[entry.ID]; duplicate {
			return nil, ErrInvalid
		}
		resolver.entries[entry.ID] = entry
		if entry.AccessPolicy != nil {
			if err := entry.AccessPolicy.Validate(); err != nil {
				return nil, err
			}
		}
	}
	// 分享根的外层祖先仍须可见，不能把回收父目录绕成新的可用根。
	root, ok := resolver.entries[share.RootID]
	if !ok {
		return nil, ErrMissing
	}
	seen := map[string]bool{}
	for {
		if seen[root.ID] {
			return nil, ErrInvalid
		}
		seen[root.ID] = true
		if root.TrashedAt != nil {
			return nil, ErrMissing
		}
		if root.ParentID == "" {
			break
		}
		root, ok = resolver.entries[root.ParentID]
		if !ok || root.Kind != Folder {
			return nil, ErrMissing
		}
	}
	permissions, reason := audienceDecision(share.Permissions, share.Audience, viewer)
	if viewer.AccountID != "" && viewer.AccountID == share.OwnerID {
		permissions, reason = ShareEditor, AccessOwner
	} else if viewer.AccountID != "" && viewer.Administrator {
		permissions, reason = ShareEditor, AccessAdministrator
	}
	resolver.decisions[share.RootID] = AccessDecision{Permissions: permissions, Reason: reason}
	return resolver, nil
}

// Decision 求取分享范围内目标最近的有效策略，拒绝越界、回收路径和循环。
func (r *ShareAccessResolver) Decision(id string) (AccessDecision, error) {
	if decision, ok := r.decisions[id]; ok {
		return decision, nil
	}
	path := []Entry{}
	seen := map[string]bool{}
	current := id
	var base AccessDecision
	for {
		if cached, ok := r.decisions[current]; ok {
			base = cached
			break
		}
		if seen[current] {
			return AccessDecision{}, ErrInvalid
		}
		seen[current] = true
		entry, ok := r.entries[current]
		if !ok || entry.TrashedAt != nil {
			return AccessDecision{}, ErrMissing
		}
		path = append(path, entry)
		parent, ok := r.entries[entry.ParentID]
		if !ok || parent.Kind != Folder {
			return AccessDecision{}, ErrMissing
		}
		current = parent.ID
	}
	for index := len(path) - 1; index >= 0; index-- {
		entry := path[index]
		if entry.AccessPolicy != nil && base.Reason != AccessOwner && base.Reason != AccessAdministrator {
			permissions, reason := audienceDecision(entry.AccessPolicy.Default, entry.AccessPolicy.Audience, r.viewer)
			base = AccessDecision{Permissions: permissions, Reason: reason, SourceEntryID: entry.ID}
		}
		r.decisions[entry.ID] = base
	}
	return base, nil
}

// Discoverable 不允许越过缺少浏览权限的父目录直接通过搜索暴露子项。
func (r *ShareAccessResolver) Discoverable(id string) (bool, error) {
	path := []string{}
	current := id
	allowed := true
	for {
		if cached, ok := r.discovery[current]; ok {
			allowed = cached
			break
		}
		decision, err := r.Decision(current)
		if err != nil {
			return false, err
		}
		path = append(path, current)
		if !decision.Permissions.Allows(ShareBrowse) {
			allowed = false
			break
		}
		if current == r.share.RootID {
			break
		}
		current = r.entries[current].ParentID
	}
	for _, entryID := range path {
		r.discovery[entryID] = allowed
	}
	return allowed, nil
}
