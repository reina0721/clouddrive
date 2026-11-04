package service

import (
	"context"
	"errors"
	"sort"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

const ShortcutMediaType = "application/vnd.clouddrive.share-shortcut"

// Navigation 拥有保存引用与固定导航业务，不持有解锁授权或外部客户端。
type Navigation struct {
	files  *Service
	store  NavigationRepository
	shares ShortcutTargets
	policy NavigationPolicy
}

func NewNavigation(files *Service, store NavigationRepository, shares ShortcutTargets, policy NavigationPolicy) (*Navigation, error) {
	if files == nil || store == nil || shares == nil {
		return nil, model.ErrInvalid
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	return &Navigation{files: files, store: store, shares: shares, policy: policy}, nil
}
func shortcutCount(entries []model.Entry) int {
	count := 0
	for _, entry := range entries {
		if entry.Kind == model.Shortcut {
			count++
		}
	}
	return count
}

type ShortcutRequest struct {
	Token    string `json:"token" minLength:"43" maxLength:"43" pattern:"^[A-Za-z0-9_-]{43}$"`
	ParentID string `json:"parentId" maxLength:"36"`
	Name     string `json:"name" minLength:"1" maxLength:"255"`
}

func (n *Navigation) CreateShortcut(ctx context.Context, owner string, input ShortcutRequest) (model.Entry, error) {
	if owner == "" || !validSecret(input.Token) {
		return model.Entry{}, model.ErrInvalid
	}
	normalized, err := n.files.normalizedName(input.Name)
	if err != nil {
		return model.Entry{}, err
	}
	state, err := n.shares.InspectShortcutTarget(ctx, input.Token, n.policy.TreeEntries)
	if err != nil {
		return model.Entry{}, err
	}
	if state.Status != ShareActive {
		return model.Entry{}, model.ErrMissing
	}
	id, err := n.files.ids.New()
	if err != nil {
		return model.Entry{}, err
	}
	now := n.files.clock.Now().UTC()
	return n.store.CreateShortcut(ctx, owner, func(entries []model.Entry) (model.Entry, error) {
		if err := model.Parent(entries, input.ParentID); err != nil {
			return model.Entry{}, err
		}
		// 同目录重复保存相同引用仍返回同一条目，不通过重复点击耗尽元数据预算。
		for _, entry := range entries {
			if entry.Kind == model.Shortcut && entry.ShareToken == input.Token && entry.ParentID == input.ParentID && entry.NormalizedName == normalized && model.Visible(entries, entry) {
				return entry, nil
			}
		}
		if err := model.Available(entries, "", input.ParentID, normalized); err != nil {
			return model.Entry{}, err
		}
		if shortcutCount(entries) >= n.policy.ShortcutLimit {
			return model.Entry{}, model.ErrTooLarge
		}
		return model.Entry{ID: id, OwnerID: owner, ParentID: input.ParentID, Kind: model.Shortcut, Name: input.Name, NormalizedName: normalized, ShareToken: input.Token, MediaType: ShortcutMediaType, ContentRevision: 1, CreatedAt: now, UpdatedAt: now}, nil
	})
}

type ShortcutSummary struct {
	Entry  model.Entry         `json:"entry"`
	Target ShortcutTargetState `json:"target"`
}
type ShortcutListing struct {
	Items         []ShortcutSummary `json:"items"`
	NextCursor    string            `json:"nextCursor"`
	PageSize      int               `json:"pageSize"`
	ShortcutLimit int               `json:"shortcutLimit"`
}
type ShortcutFilter string

const (
	ShortcutsAll         ShortcutFilter = ""
	ShortcutsActive      ShortcutFilter = "active"
	ShortcutsProtected   ShortcutFilter = "protected"
	ShortcutsUnavailable ShortcutFilter = "unavailable"
)

func (n *Navigation) target(ctx context.Context, token string) (ShortcutTargetState, error) {
	state, err := n.shares.InspectShortcutTarget(ctx, token, n.policy.TreeEntries)
	if errors.Is(err, model.ErrMissing) {
		return ShortcutTargetState{Status: ShareUnavailable}, nil
	}
	return state, err
}
func (n *Navigation) Shortcuts(ctx context.Context, owner, search, cursor string, filter ShortcutFilter) (ShortcutListing, error) {
	if len(search) > model.MaxNameRunes*4 || (cursor != "" && idgen.Validate(cursor) != nil) {
		return ShortcutListing{}, model.ErrInvalid
	}
	if filter != ShortcutsAll && filter != ShortcutsActive && filter != ShortcutsProtected && filter != ShortcutsUnavailable {
		return ShortcutListing{}, model.ErrInvalid
	}
	snapshot, err := n.store.ReadNavigation(ctx, owner)
	if err != nil {
		return ShortcutListing{}, err
	}
	if snapshot.EntriesUnavailable {
		return ShortcutListing{}, model.ErrTooLarge
	}
	candidates := []model.Entry{}
	for _, entry := range snapshot.Entries {
		if entry.Kind == model.Shortcut && entry.ID > cursor && model.Visible(snapshot.Entries, entry) && strings.Contains(strings.ToLower(entry.Name), strings.ToLower(search)) {
			candidates = append(candidates, entry)
		}
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].ID < candidates[j].ID })
	result := ShortcutListing{Items: []ShortcutSummary{}, PageSize: n.policy.PageSize, ShortcutLimit: n.policy.ShortcutLimit}
	for _, entry := range candidates {
		if err := ctx.Err(); err != nil {
			return ShortcutListing{}, err
		}
		state, err := n.target(ctx, entry.ShareToken)
		if err != nil {
			return ShortcutListing{}, err
		}
		matches := filter == ShortcutsAll || (filter == ShortcutsActive && state.Status == ShareActive && !state.Locked) || (filter == ShortcutsProtected && state.Status == ShareActive && state.Locked) || (filter == ShortcutsUnavailable && state.Status != ShareActive)
		if !matches {
			continue
		}
		if len(result.Items) == n.policy.PageSize {
			result.NextCursor = result.Items[len(result.Items)-1].Entry.ID
			break
		}
		result.Items = append(result.Items, ShortcutSummary{Entry: entry, Target: state})
	}
	return result, nil
}
func (n *Navigation) OpenShortcut(ctx context.Context, owner, id string) (string, error) {
	snapshot, err := n.store.ReadNavigation(ctx, owner)
	if err != nil {
		return "", err
	}
	if snapshot.EntriesUnavailable {
		return "", model.ErrTooLarge
	}
	entry, ok := model.Find(snapshot.Entries, id)
	if !ok || entry.Kind != model.Shortcut || !model.Visible(snapshot.Entries, entry) {
		return "", model.ErrMissing
	}
	state, err := n.target(ctx, entry.ShareToken)
	if err != nil {
		return "", err
	}
	if state.Status != ShareActive {
		return "", model.ErrMissing
	}
	return entry.ShareToken, nil
}
func (n *Navigation) PurgeShortcut(ctx context.Context, owner, id string, revision int64) error {
	return n.store.PurgeShortcut(ctx, owner, id, revision)
}

type PinView struct {
	ID         string        `json:"id"`
	TargetKind model.PinKind `json:"targetKind"`
	TargetID   string        `json:"targetId"`
	Name       string        `json:"name"`
	Position   int           `json:"position"`
	Available  bool          `json:"available"`
	Locked     bool          `json:"locked"`
}
type PinListing struct {
	Items           []PinView `json:"items"`
	Revision        int64     `json:"revision"`
	Limit           int       `json:"limit"`
	MetadataLimited bool      `json:"metadataLimited"`
}

func (n *Navigation) Pins(ctx context.Context, owner string) (PinListing, error) {
	snapshot, err := n.store.ReadNavigation(ctx, owner)
	if err != nil {
		return PinListing{}, err
	}
	result := PinListing{Items: []PinView{}, Revision: snapshot.Revision, Limit: n.policy.PinLimit, MetadataLimited: snapshot.EntriesUnavailable}
	for _, pin := range snapshot.Pins {
		if err := ctx.Err(); err != nil {
			return PinListing{}, err
		}
		item := PinView{ID: pin.ID, TargetKind: pin.TargetKind, TargetID: pin.TargetID, Position: pin.Position}
		switch pin.TargetKind {
		case model.PinShared:
			item.Available = pin.TargetID == ""
		case model.PinFolder:
			if !snapshot.EntriesUnavailable {
				if pin.TargetID == "" {
					item.Available = true
				} else if entry, ok := model.Find(snapshot.Entries, pin.TargetID); ok && entry.Kind == model.Folder {
					item.Name = entry.Name
					item.Available = model.Visible(snapshot.Entries, entry)
				}
			}
		case model.PinShortcut:
			if !snapshot.EntriesUnavailable {
				if entry, ok := model.Find(snapshot.Entries, pin.TargetID); ok && entry.Kind == model.Shortcut {
					item.Name = entry.Name
					if model.Visible(snapshot.Entries, entry) {
						state, err := n.target(ctx, entry.ShareToken)
						if err != nil {
							return PinListing{}, err
						}
						item.Available = state.Status == ShareActive
						item.Locked = state.Locked
					}
				}
			}
		default:
			return PinListing{}, model.ErrInvalid
		}
		result.Items = append(result.Items, item)
	}
	return result, nil
}

type PinRequest struct {
	Revision   int64         `json:"revision" minimum:"0"`
	TargetKind model.PinKind `json:"targetKind" enum:"folder,shared,shortcut"`
	TargetID   string        `json:"targetId"`
}

func (n *Navigation) AddPin(ctx context.Context, owner string, input PinRequest) (int64, error) {
	if !input.TargetKind.Valid() || (input.TargetID != "" && idgen.Validate(input.TargetID) != nil) {
		return 0, model.ErrInvalid
	}
	id, err := n.files.ids.New()
	if err != nil {
		return 0, err
	}
	now := n.files.clock.Now().UTC()
	snapshot, err := n.store.ChangePins(ctx, owner, input.Revision, func(snapshot NavigationSnapshot) ([]model.Pin, error) {
		if len(snapshot.Pins) >= n.policy.PinLimit {
			return nil, model.ErrTooLarge
		}
		for _, pin := range snapshot.Pins {
			if pin.TargetKind == input.TargetKind && pin.TargetID == input.TargetID {
				return nil, model.ErrConflict
			}
		}
		if input.TargetKind == model.PinShared {
			if input.TargetID != "" {
				return nil, model.ErrInvalid
			}
		} else {
			if snapshot.EntriesUnavailable {
				return nil, model.ErrTooLarge
			}
			if input.TargetKind == model.PinFolder {
				if err := model.Parent(snapshot.Entries, input.TargetID); err != nil {
					return nil, err
				}
			} else {
				entry, ok := model.Find(snapshot.Entries, input.TargetID)
				if !ok || entry.Kind != model.Shortcut || !model.Visible(snapshot.Entries, entry) {
					return nil, model.ErrMissing
				}
			}
		}
		return append(append([]model.Pin(nil), snapshot.Pins...), model.Pin{ID: id, OwnerID: owner, TargetKind: input.TargetKind, TargetID: input.TargetID, CreatedAt: now}), nil
	})
	return snapshot.Revision, err
}
func (n *Navigation) RemovePin(ctx context.Context, owner, id string, revision int64) (int64, error) {
	snapshot, err := n.store.ChangePins(ctx, owner, revision, func(snapshot NavigationSnapshot) ([]model.Pin, error) {
		pins := []model.Pin{}
		found := false
		for _, pin := range snapshot.Pins {
			if pin.ID == id {
				found = true
			} else {
				pins = append(pins, pin)
			}
		}
		if !found {
			return nil, model.ErrMissing
		}
		return pins, nil
	})
	return snapshot.Revision, err
}
func (n *Navigation) ReorderPins(ctx context.Context, owner string, revision int64, ids []string) (int64, error) {
	if len(ids) > DefaultPinLimit {
		return 0, model.ErrTooLarge
	}
	snapshot, err := n.store.ChangePins(ctx, owner, revision, func(snapshot NavigationSnapshot) ([]model.Pin, error) {
		if len(ids) != len(snapshot.Pins) {
			return nil, model.ErrConflict
		}
		pins := make([]model.Pin, 0, len(ids))
		seen := map[string]bool{}
		for _, id := range ids {
			if seen[id] {
				return nil, model.ErrInvalid
			}
			seen[id] = true
			found := false
			for _, pin := range snapshot.Pins {
				if pin.ID == id {
					pins = append(pins, pin)
					found = true
					break
				}
			}
			if !found {
				return nil, model.ErrConflict
			}
		}
		return pins, nil
	})
	return snapshot.Revision, err
}
