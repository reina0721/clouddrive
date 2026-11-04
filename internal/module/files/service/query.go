package service

import (
	"context"
	"path"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	DefaultSearchTreeEntries       = 10000
	DefaultListPageSize            = 50
	MaxListPageSize                = 200
	MaxQueryKeywords               = 8
	MaxQueryExtensions             = 16
	MaxQueryBytes            int64 = 1<<53 - 1
)

type SearchScope string

const (
	ScopeAutomatic SearchScope = "auto"
	ScopeFolder    SearchScope = "folder"
	ScopeTree      SearchScope = "tree"
	ScopeAll       SearchScope = "all"
)

type KeywordMatch string

const (
	MatchAll KeywordMatch = "all"
	MatchAny KeywordMatch = "any"
)

type SortKey string

const (
	SortName    SortKey = "name"
	SortSize    SortKey = "size"
	SortUpdated SortKey = "updated"
	SortCreated SortKey = "created"
)

// Query 的零值保留普通目录语义；PageSize=0明确表示有界快照不分页。
type Query struct {
	ParentID      string
	Search        string
	Category      string
	Trash         bool
	Sort          SortKey
	Desc          bool
	Scope         SearchScope
	Keywords      []string
	CaseSensitive bool
	Match         KeywordMatch
	Kinds         []model.Kind
	Extensions    []string
	MinBytes      *int64
	MaxBytes      *int64
	CreatedFrom   *time.Time
	CreatedTo     *time.Time
	ModifiedFrom  *time.Time
	ModifiedTo    *time.Time
	FoldersFirst  bool
	Page          int
	PageSize      int
	Tags          []string
	TagMatch      KeywordMatch
	Property      *AnnotationPropertyFilter
}

type Listing struct {
	Items               []model.Entry       `json:"items"`
	Breadcrumbs         []model.Entry       `json:"breadcrumbs"`
	UsedBytes           int64               `json:"usedBytes"`
	QuotaBytes          int64               `json:"quotaBytes"`
	MaxFileBytes        int64               `json:"maxFileBytes"`
	ConcurrentUploads   int                 `json:"concurrentUploads"`
	MaxTextBytes        int64               `json:"maxTextBytes"`
	MaxArchiveBytes     int64               `json:"maxArchiveBytes"`
	MaxBatchEntries     int                 `json:"maxBatchEntries"`
	MaxThumbnailBytes   int64               `json:"maxThumbnailBytes"`
	MaxMediaBytes       int64               `json:"maxMediaBytes"`
	MaxGalleryEntries   int                 `json:"maxGalleryEntries"`
	Total               int                 `json:"total"`
	Page                int                 `json:"page"`
	PageSize            int                 `json:"pageSize"`
	DefaultPageSize     int                 `json:"defaultPageSize"`
	MaxPageSize         int                 `json:"maxPageSize"`
	SearchTreeEntries   int                 `json:"searchTreeEntries"`
	MaxKeywords         int                 `json:"maxKeywords"`
	MaxExtensions       int                 `json:"maxExtensions"`
	AnnotationSummaries []AnnotationSummary `json:"annotationSummaries"`
	AnnotationLimits    AnnotationLimits    `json:"annotationLimits"`
}

func validSearchText(value string) bool {
	if !utf8.ValidString(value) || utf8.RuneCountInString(value) > model.MaxNameRunes {
		return false
	}
	for _, character := range value {
		if unicode.IsControl(character) {
			return false
		}
	}
	return true
}
func (s *Service) prepareQuery(q Query) (Query, error) {
	var annotationError error
	q, annotationError = s.prepareAnnotationQuery(q)
	if annotationError != nil {
		return Query{}, annotationError
	}
	if !validSearchText(q.Search) || len(q.Keywords) > MaxQueryKeywords || len(q.Extensions) > MaxQueryExtensions || len(q.Kinds) > 3 {
		return Query{}, model.ErrInvalid
	}
	if q.Category != "" && q.Category != "image" && q.Category != "video" && q.Category != "audio" && q.Category != "document" {
		return Query{}, model.ErrInvalid
	}
	if q.Sort == "" {
		q.Sort = SortName
	}
	if q.Sort != SortName && q.Sort != SortSize && q.Sort != SortUpdated && q.Sort != SortCreated {
		return Query{}, model.ErrInvalid
	}
	if q.Scope == "" {
		q.Scope = ScopeAutomatic
	}
	if q.Scope != ScopeAutomatic && q.Scope != ScopeFolder && q.Scope != ScopeTree && q.Scope != ScopeAll {
		return Query{}, model.ErrInvalid
	}
	if q.Scope == ScopeAutomatic {
		q.Scope = ScopeFolder
		if q.Search != "" || len(q.Keywords) > 0 || q.Category != "" || q.Trash || len(q.Tags) > 0 || q.Property != nil {
			q.Scope = ScopeAll
		}
	}
	if q.Match == "" {
		q.Match = MatchAll
	}
	if q.Match != MatchAll && q.Match != MatchAny {
		return Query{}, model.ErrInvalid
	}
	q.Keywords = append([]string(nil), q.Keywords...)
	q.Extensions = append([]string(nil), q.Extensions...)
	normalize := func(value string) string {
		value = s.names.Normalize(value)
		if !q.CaseSensitive {
			value = strings.ToLower(value)
		}
		return value
	}
	q.Search = normalize(q.Search)
	for index, keyword := range q.Keywords {
		keyword = strings.TrimSpace(keyword)
		if keyword == "" || !validSearchText(keyword) {
			return Query{}, model.ErrInvalid
		}
		q.Keywords[index] = normalize(keyword)
	}
	kinds := map[model.Kind]bool{}
	for _, kind := range q.Kinds {
		if (kind != model.File && kind != model.Folder && kind != model.Shortcut) || kinds[kind] {
			return Query{}, model.ErrInvalid
		}
		kinds[kind] = true
	}
	for index, extension := range q.Extensions {
		extension = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(extension), "."))
		if extension == "" || len(extension) > 32 {
			return Query{}, model.ErrInvalid
		}
		for _, character := range extension {
			if !(character >= 'a' && character <= 'z' || character >= '0' && character <= '9' || character == '_' || character == '-' || character == '+') {
				return Query{}, model.ErrInvalid
			}
		}
		q.Extensions[index] = extension
	}
	for _, bound := range []*int64{q.MinBytes, q.MaxBytes} {
		if bound != nil && (*bound < 0 || *bound > MaxQueryBytes) {
			return Query{}, model.ErrInvalid
		}
	}
	if q.MinBytes != nil && q.MaxBytes != nil && *q.MinBytes > *q.MaxBytes {
		return Query{}, model.ErrInvalid
	}
	for _, bounds := range [][2]*time.Time{{q.CreatedFrom, q.CreatedTo}, {q.ModifiedFrom, q.ModifiedTo}} {
		if bounds[0] != nil && bounds[1] != nil && !bounds[0].Before(*bounds[1]) {
			return Query{}, model.ErrInvalid
		}
	}
	if q.Page < 0 || q.Page > DefaultSearchTreeEntries || q.PageSize < 0 || q.PageSize > MaxListPageSize || q.PageSize == 0 && q.Page > 1 {
		return Query{}, model.ErrInvalid
	}
	return q, nil
}

// queryTree 只在当前请求内记忆祖先事实，避免对每一条目重复扫描整棵树。
type queryWalkMode uint8

const (
	walkVisibility queryWalkMode = iota
	walkDescendants
)

type queryTree struct {
	entries     map[string]model.Entry
	visible     map[string]bool
	descendants map[string]bool
	root        string
}

func newQueryTree(ctx context.Context, entries []model.Entry, root string) (*queryTree, error) {
	tree := &queryTree{entries: make(map[string]model.Entry, len(entries)), visible: map[string]bool{}, descendants: map[string]bool{}, root: root}
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if _, exists := tree.entries[entry.ID]; exists {
			return nil, model.ErrConflict
		}
		tree.entries[entry.ID] = entry
	}
	return tree, nil
}
func (t *queryTree) walk(ctx context.Context, id string, mode queryWalkMode) (bool, error) {
	descendants := mode == walkDescendants
	cache := t.visible
	if descendants {
		cache = t.descendants
		if t.root == "" {
			return true, ctx.Err()
		}
	}
	pathIDs := []string{}
	seen := map[string]bool{}
	valid := false
	for remaining := len(t.entries) + 1; remaining > 0; remaining-- {
		if err := ctx.Err(); err != nil {
			return false, err
		}
		if value, known := cache[id]; known {
			valid = value
			break
		}
		if descendants && id == t.root {
			valid = true
			break
		}
		entry, exists := t.entries[id]
		if !exists || seen[id] {
			break
		}
		seen[id] = true
		pathIDs = append(pathIDs, id)
		if !descendants && entry.TrashedAt != nil {
			break
		}
		if entry.ParentID == "" {
			valid = !descendants
			break
		}
		parent, exists := t.entries[entry.ParentID]
		if !exists || parent.Kind != model.Folder {
			break
		}
		id = parent.ID
	}
	for _, visited := range pathIDs {
		cache[visited] = valid
	}
	return valid, nil
}

func (s *Service) matchesQuery(entry model.Entry, q Query) bool {
	if !s.matchesAnnotationQuery(entry.Annotations, q) {
		return false
	}
	name := s.names.Normalize(entry.Name)
	if !q.CaseSensitive {
		name = strings.ToLower(name)
	}
	if q.Search != "" && !strings.Contains(name, q.Search) {
		return false
	}
	if len(q.Keywords) > 0 {
		matched := q.Match == MatchAll
		for _, keyword := range q.Keywords {
			contains := strings.Contains(name, keyword)
			if q.Match == MatchAll && !contains {
				matched = false
				break
			}
			if q.Match == MatchAny && contains {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}
	if q.Category != "" && (entry.Kind != model.File || model.Category(entry) != q.Category) {
		return false
	}
	if len(q.Kinds) > 0 {
		found := false
		for _, kind := range q.Kinds {
			if entry.Kind == kind {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	if len(q.Extensions) > 0 {
		if entry.Kind != model.File {
			return false
		}
		extension := strings.ToLower(strings.TrimPrefix(path.Ext(entry.Name), "."))
		found := false
		for _, candidate := range q.Extensions {
			if extension == candidate {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	if q.MinBytes != nil || q.MaxBytes != nil {
		if entry.Kind != model.File {
			return false
		}
		if q.MinBytes != nil && entry.SizeBytes < *q.MinBytes || q.MaxBytes != nil && entry.SizeBytes > *q.MaxBytes {
			return false
		}
	}
	for _, interval := range []struct {
		instant  time.Time
		from, to *time.Time
	}{{entry.CreatedAt, q.CreatedFrom, q.CreatedTo}, {entry.UpdatedAt, q.ModifiedFrom, q.ModifiedTo}} {
		if interval.from != nil && interval.instant.Before(*interval.from) || interval.to != nil && !interval.instant.Before(*interval.to) {
			return false
		}
	}
	return true
}

func (s *Service) List(ctx context.Context, owner string, input Query) (Listing, error) {
	if owner == "" {
		return Listing{}, model.ErrMissing
	}
	q, err := s.prepareQuery(input)
	if err != nil {
		return Listing{}, err
	}
	entries, err := s.repo.ReadBounded(ctx, owner, s.policy.SearchTreeEntries)
	if err != nil {
		return Listing{}, err
	}
	tree, err := newQueryTree(ctx, entries, q.ParentID)
	if err != nil {
		return Listing{}, err
	}
	result := Listing{Items: []model.Entry{}, Breadcrumbs: []model.Entry{}, UsedBytes: model.Used(entries), QuotaBytes: s.policy.QuotaBytes, MaxFileBytes: s.policy.MaxFileBytes, ConcurrentUploads: s.policy.ConcurrentUploads, MaxTextBytes: s.policy.MaxTextBytes, MaxArchiveBytes: s.policy.MaxArchiveBytes, MaxBatchEntries: s.policy.MaxBatchEntries, MaxThumbnailBytes: s.policy.MaxThumbnailBytes, MaxMediaBytes: s.policy.MaxMediaBytes, MaxGalleryEntries: s.policy.MaxGalleryEntries, DefaultPageSize: DefaultListPageSize, MaxPageSize: MaxListPageSize, SearchTreeEntries: s.policy.SearchTreeEntries, MaxKeywords: MaxQueryKeywords, MaxExtensions: MaxQueryExtensions}
	result.AnnotationSummaries = []AnnotationSummary{}
	result.AnnotationLimits = s.annotationLimits()
	if q.ParentID != "" {
		parent, exists := tree.entries[q.ParentID]
		if !exists || parent.Kind != model.Folder {
			return Listing{}, model.ErrMissing
		}
		if !q.Trash {
			visible, err := tree.walk(ctx, q.ParentID, walkVisibility)
			if err != nil {
				return Listing{}, err
			}
			if !visible {
				return Listing{}, model.ErrMissing
			}
		}
	}
	for parent := q.ParentID; parent != ""; {
		if err := ctx.Err(); err != nil {
			return Listing{}, err
		}
		entry, exists := tree.entries[parent]
		if !exists {
			return Listing{}, model.ErrMissing
		}
		result.Breadcrumbs = append(result.Breadcrumbs, entry)
		parent = entry.ParentID
		if len(result.Breadcrumbs) > len(entries) {
			return Listing{}, model.ErrConflict
		}
	}
	for left, right := 0, len(result.Breadcrumbs)-1; left < right; left, right = left+1, right-1 {
		result.Breadcrumbs[left], result.Breadcrumbs[right] = result.Breadcrumbs[right], result.Breadcrumbs[left]
	}
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return Listing{}, err
		}
		if q.Trash {
			if entry.TrashedAt == nil {
				continue
			}
		} else {
			visible, err := tree.walk(ctx, entry.ID, walkVisibility)
			if err != nil {
				return Listing{}, err
			}
			if !visible {
				continue
			}
		}
		if q.Scope == ScopeFolder && entry.ParentID != q.ParentID {
			continue
		}
		if q.Scope == ScopeTree {
			if entry.ID == q.ParentID {
				continue
			}
			inside, err := tree.walk(ctx, entry.ID, walkDescendants)
			if err != nil {
				return Listing{}, err
			}
			if !inside {
				continue
			}
		}
		if s.matchesQuery(entry, q) {
			result.Items = append(result.Items, entry)
		}
	}
	sort.Slice(result.Items, func(i, j int) bool {
		a, b := result.Items[i], result.Items[j]
		if q.FoldersFirst && (a.Kind == model.Folder) != (b.Kind == model.Folder) {
			return a.Kind == model.Folder
		}
		comparison := 0
		switch q.Sort {
		case SortSize:
			if a.SizeBytes < b.SizeBytes {
				comparison = -1
			} else if a.SizeBytes > b.SizeBytes {
				comparison = 1
			}
		case SortUpdated:
			comparison = a.UpdatedAt.Compare(b.UpdatedAt)
		case SortCreated:
			comparison = a.CreatedAt.Compare(b.CreatedAt)
		default:
			comparison = strings.Compare(a.NormalizedName, b.NormalizedName)
		}
		if comparison == 0 {
			comparison = strings.Compare(a.ID, b.ID)
		}
		if q.Desc {
			return comparison > 0
		}
		return comparison < 0
	})
	if err := ctx.Err(); err != nil {
		return Listing{}, err
	}
	result.Total = len(result.Items)
	if q.PageSize > 0 {
		result.Page = max(1, q.Page)
		result.PageSize = q.PageSize
		start := (result.Page - 1) * q.PageSize
		if start >= result.Total {
			result.Items = []model.Entry{}
		} else {
			result.Items = result.Items[start:min(start+q.PageSize, result.Total)]
		}
	}
	if q.PageSize > 0 {
		for _, entry := range result.Items {
			result.AnnotationSummaries = append(result.AnnotationSummaries, annotationSummary(entry))
		}
	}
	return result, nil
}
