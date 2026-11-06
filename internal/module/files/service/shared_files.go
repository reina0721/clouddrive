package service

import (
	"context"
	"errors"
	"io"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type PublicFileQuery struct {
	Parent string
	Search string
	Sort   SortKey
	Desc   bool
	Scope  SearchScope
	Page   int
}
type PublicText struct {
	Entry PublicEntry `json:"entry"`
	Text  string      `json:"text"`
}
type SharedTextCreate struct {
	ParentID string `json:"parentId" maxLength:"36"`
	Name     string `json:"name" minLength:"1" maxLength:"255"`
	Key      string `json:"clientKey" minLength:"16" maxLength:"64"`
	Text     string `json:"text" maxLength:"1048576"`
}
type SharedItemVersion struct {
	ID        string    `json:"id" minLength:"36" maxLength:"36"`
	Revision  int64     `json:"revision" minimum:"1" maximum:"9007199254740990"`
	UpdatedAt time.Time `json:"updatedAt"`
}
type SharedItemChange struct {
	SharedItemVersion
	Action   string `json:"action" enum:"rename,move,copy,trash"`
	Name     string `json:"name" maxLength:"255"`
	ParentID string `json:"parentId" maxLength:"36"`
}

func (s *Sharing) Entries(ctx context.Context, token, ticket string, query PublicFileQuery) (PublicListing, error) {
	if query.Page == 0 {
		query.Page = 1
	}
	if query.Scope == "" {
		query.Scope = ScopeFolder
	}
	if query.Scope != ScopeFolder && query.Scope != ScopeTree {
		return PublicListing{}, model.ErrInvalid
	}
	files, access, _, err := s.scope(ctx, token, ticket, ShareActionBrowse, SharedSelection{Destination: &query.Parent})
	if err != nil {
		return PublicListing{}, err
	}
	snapshot, err := s.inspect(ctx, token, ticket)
	if err != nil {
		return PublicListing{}, err
	}
	if err := s.validateAccess(ctx, snapshot, access); err != nil {
		return PublicListing{}, err
	}
	viewer, err := s.accounts.ShareViewer(ctx)
	if err != nil {
		return PublicListing{}, err
	}
	resolver, err := model.NewShareAccessResolver(snapshot.Entries, snapshot.Share, viewer)
	if err != nil {
		return PublicListing{}, err
	}
	filtered := []model.Entry{}
	for _, entry := range snapshot.Entries {
		if err := ctx.Err(); err != nil {
			return PublicListing{}, err
		}
		allowed, err := resolver.Discoverable(entry.ID)
		if errors.Is(err, model.ErrMissing) {
			continue
		}
		if err != nil {
			return PublicListing{}, err
		}
		if !allowed {
			continue
		}
		if entry.ID == snapshot.Share.RootID {
			entry.ParentID = ""
		}
		filtered = append(filtered, entry)
	}
	prepared, err := files.prepareQuery(Query{ParentID: *access.Destination, Search: query.Search, Sort: query.Sort, Desc: query.Desc, Scope: query.Scope, Page: query.Page, PageSize: SharePageSize, FoldersFirst: true})
	if err != nil {
		return PublicListing{}, err
	}
	listing, err := files.listEntries(ctx, filtered, prepared)
	if err != nil {
		return PublicListing{}, err
	}
	directory, err := resolver.Decision(*access.Destination)
	if err != nil {
		return PublicListing{}, err
	}
	result := PublicListing{Permissions: sharePermissions(directory.Permissions), Items: []PublicEntry{}, Breadcrumbs: []PublicEntry{}, Total: listing.Total, Page: listing.Page, PageSize: listing.PageSize}
	project := func(entry model.Entry) (PublicEntry, error) {
		decision, err := resolver.Decision(entry.ID)
		if err != nil {
			return PublicEntry{}, err
		}
		result := publicEntry(entry)
		result.Permissions = sharePermissions(decision.Permissions)
		return result, nil
	}
	for _, entry := range listing.Items {
		item, err := project(entry)
		if err != nil {
			return PublicListing{}, err
		}
		result.Items = append(result.Items, item)
	}
	for _, entry := range listing.Breadcrumbs {
		item, err := project(entry)
		if err != nil {
			return PublicListing{}, err
		}
		result.Breadcrumbs = append(result.Breadcrumbs, item)
	}

	return result, nil
}
func (s *Sharing) ReadText(ctx context.Context, token, ticket, id string) (PublicText, error) {
	files, _, owner, err := s.scope(ctx, token, ticket, ShareActionPreview, SharedSelection{Targets: []string{id}})
	if err != nil {
		return PublicText{}, err
	}
	entry, payload, err := files.ReadSmall(ctx, owner, id, s.files.policy.MaxTextBytes)
	if err != nil {
		return PublicText{}, err
	}
	if !editableText(entry) || !utf8.Valid(payload) || strings.IndexByte(string(payload), 0) >= 0 {
		return PublicText{}, model.ErrUnsupported
	}
	presented, presentErr := s.describePublicEntry(ctx, token, ticket, entry)
	if presentErr != nil {
		return PublicText{}, presentErr
	}
	return PublicText{Entry: presented, Text: string(payload)}, nil
}

// ContentTo 按实际读取能力授权；下载许可可读取原始文件，仅预览许可执行安全类型与字节预算。
func (s *Sharing) ContentTo(ctx context.Context, token, ticket, id string, use func(model.Entry, io.ReadSeeker) error) error {
	snapshot, err := s.inspect(ctx, token, ticket)
	if err != nil {
		return err
	}
	action := ShareActionPreview
	permissions, permissionErr := s.publicPermissions(ctx, snapshot, id)
	if permissionErr != nil {
		return permissionErr
	}
	if permissions.Download {
		action = ShareActionDownload
	}
	files, _, owner, err := s.scope(ctx, token, ticket, action, SharedSelection{Targets: []string{id}})
	if err != nil {
		return err
	}
	return files.DownloadTo(ctx, owner, id, func(entry model.Entry, reader io.ReadSeeker) error {
		if action == ShareActionDownload {
			return use(entry, reader)
		}
		limit := s.files.policy.MaxMediaBytes
		if editableText(entry) {
			limit = s.files.policy.MaxTextBytes
		} else if !safeSharedMedia(entry.MediaType) {
			return model.ErrUnsupported
		}
		if entry.SizeBytes > limit {
			return model.ErrTooLarge
		}
		return use(entry, reader)
	})
}
func safeSharedMedia(mediaType string) bool {
	mediaType = strings.ToLower(strings.TrimSpace(strings.Split(mediaType, ";")[0]))
	switch mediaType {
	case "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/bmp":
		return true
	}
	return strings.HasPrefix(mediaType, "audio/") || strings.HasPrefix(mediaType, "video/")
}
func (s *Sharing) CreateFolder(ctx context.Context, token, ticket, parent, name string) (PublicEntry, error) {
	files, access, owner, err := s.scope(ctx, token, ticket, ShareActionCreate, SharedSelection{Destination: &parent})
	if err != nil {
		return PublicEntry{}, err
	}
	entry, err := files.Folder(ctx, owner, *access.Destination, name)
	if err != nil {
		return PublicEntry{}, err
	}
	return s.describePublicEntry(ctx, token, ticket, entry)
}
func (s *Sharing) CreateText(ctx context.Context, token, ticket string, input SharedTextCreate) (PublicEntry, error) {
	files, access, owner, err := s.scope(ctx, token, ticket, ShareActionCreate, SharedSelection{Destination: &input.ParentID})
	if err != nil {
		return PublicEntry{}, err
	}
	entry, err := files.CreateText(ctx, owner, *access.Destination, input.Name, input.Key, input.Text)
	if err != nil {
		return PublicEntry{}, err
	}
	return s.describePublicEntry(ctx, token, ticket, entry)
}
func (s *Sharing) ReplaceText(ctx context.Context, token, ticket, id string, revision int64, text string) (PublicEntry, error) {
	if revision < 1 {
		return PublicEntry{}, model.ErrInvalid
	}
	files, _, owner, err := s.scope(ctx, token, ticket, ShareActionModify, SharedSelection{Targets: []string{id}, ExpectedRevision: revision})
	if err != nil {
		return PublicEntry{}, err
	}
	entry, err := files.ReplaceText(ctx, owner, id, revision, text)
	if err != nil {
		return PublicEntry{}, err
	}
	return s.describePublicEntry(ctx, token, ticket, entry)
}
func (s *Sharing) ChangeItem(ctx context.Context, token, ticket string, input SharedItemChange) (PublicEntry, error) {
	if input.Revision < 1 || input.UpdatedAt.IsZero() {
		return PublicEntry{}, model.ErrInvalid
	}
	selection := SharedSelection{Targets: []string{input.ID}, ExpectedRevision: input.Revision, ExpectedUpdatedAt: &input.UpdatedAt}
	var action ShareFileAction
	switch input.Action {
	case "rename":
		action = ShareActionRename
		if input.Name == "" || input.ParentID != "" {
			return PublicEntry{}, model.ErrInvalid
		}
	case "move":
		action = ShareActionMove
		selection.Destination = &input.ParentID
		if input.Name != "" {
			return PublicEntry{}, model.ErrInvalid
		}
	case "copy":
		action = ShareActionCopy
		selection.Destination = &input.ParentID
	case "trash":
		action = ShareActionTrash
		if input.Name != "" || input.ParentID != "" {
			return PublicEntry{}, model.ErrInvalid
		}
	default:
		return PublicEntry{}, model.ErrInvalid
	}
	files, access, owner, err := s.scope(ctx, token, ticket, action, selection)
	if err != nil {
		return PublicEntry{}, err
	}
	var entry model.Entry
	switch action {
	case ShareActionRename:
		entry, err = files.Update(ctx, owner, input.ID, Change{Name: &input.Name, ExpectedRevision: &input.Revision})
	case ShareActionMove:
		entry, err = files.Update(ctx, owner, input.ID, Change{ParentID: access.Destination, ExpectedRevision: &input.Revision})
	case ShareActionCopy:
		name := input.Name
		if name == "" {
			detail, detailErr := files.Detail(ctx, owner, input.ID)
			if detailErr != nil {
				return PublicEntry{}, detailErr
			}
			name = detail.Entry.Name
		}
		entry, err = files.Copy(ctx, owner, input.ID, *access.Destination, name)
	case ShareActionTrash:
		entry, err = files.Trash(ctx, owner, input.ID)
	}
	if err != nil {
		return PublicEntry{}, err
	}
	if input.Action == "trash" {
		return publicEntry(entry), nil
	}
	return s.describePublicEntry(ctx, token, ticket, entry)
}

type SharedBatch struct {
	Action   string              `json:"action" enum:"move,copy,trash"`
	ParentID string              `json:"parentId" maxLength:"36"`
	Items    []SharedItemVersion `json:"items" minItems:"1" maxItems:"20"`
}
type SharedItemResult struct {
	ID        string       `json:"id"`
	Entry     *PublicEntry `json:"entry,omitempty"`
	ErrorCode string       `json:"errorCode"`
}
type SharedBatchResult struct {
	Items []SharedItemResult `json:"items"`
}

func sharedErrorCode(err error) string {
	switch {
	case err == nil:
		return ""
	case errors.Is(err, model.ErrShareLocked):
		return "locked"
	case errors.Is(err, model.ErrShareForbidden):
		return "forbidden"
	case errors.Is(err, model.ErrMissing):
		return "missing"
	case errors.Is(err, model.ErrConflict):
		return "conflict"
	case errors.Is(err, model.ErrQuota):
		return "quota"
	case errors.Is(err, model.ErrBusy):
		return "busy"
	case errors.Is(err, model.ErrTooLarge):
		return "large"
	case errors.Is(err, model.ErrInvalid):
		return "invalid"
	case errors.Is(err, model.ErrUnsupported):
		return "unsupported"
	case errors.Is(err, context.Canceled):
		return "canceled"
	default:
		return "unavailable"
	}
}
func (s *Sharing) Batch(ctx context.Context, token, ticket string, input SharedBatch) (SharedBatchResult, error) {
	result := SharedBatchResult{Items: []SharedItemResult{}}
	if len(input.Items) < 1 || len(input.Items) > s.policy.BatchEntries || (input.Action != "move" && input.Action != "copy" && input.Action != "trash") || input.Action == "trash" && input.ParentID != "" {
		return result, model.ErrInvalid
	}
	seen := map[string]bool{}
	for _, item := range input.Items {
		if model.ValidateTransferID(item.ID) != nil || seen[item.ID] {
			return result, model.ErrInvalid
		}
		seen[item.ID] = true
	}
	for _, item := range input.Items {
		if err := ctx.Err(); err != nil {
			return result, err
		}
		entry, err := s.ChangeItem(ctx, token, ticket, SharedItemChange{SharedItemVersion: item, Action: input.Action, ParentID: input.ParentID})
		row := SharedItemResult{ID: item.ID, ErrorCode: sharedErrorCode(err)}
		if err == nil {
			row.Entry = &entry
		}
		result.Items = append(result.Items, row)
	}
	return result, nil
}
func (s *Sharing) Archive(ctx context.Context, token, ticket string, ids []string) ([]byte, error) {
	if len(ids) < 1 || len(ids) > s.policy.BatchEntries {
		return nil, model.ErrInvalid
	}
	files, _, owner, err := s.scope(ctx, token, ticket, ShareActionDownload, SharedSelection{Targets: ids})
	if err != nil {
		return nil, err
	}
	payload, err := files.Archive(ctx, owner, ids)
	if err != nil {
		return nil, err
	}
	if _, err := files.repo.Read(ctx, owner); err != nil {
		return nil, err
	}
	return payload, nil
}
