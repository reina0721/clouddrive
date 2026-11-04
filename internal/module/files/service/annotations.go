package service

import (
	"context"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"math"
	"slices"
	"strings"
	"time"
)

const DefaultAnnotationBatchEntries = 100
const MaxAnnotationPathBytes = 4096

type AnnotationVisibility string

const (
	AnnotationActive AnnotationVisibility = "active"
	AnnotationTrash  AnnotationVisibility = "trash"
)

type AnnotationLimits struct {
	MaxBytes              int    `json:"maxBytes"`
	MaxTags               int    `json:"maxTags"`
	MaxProperties         int    `json:"maxProperties"`
	MaxBatchEntries       int    `json:"maxBatchEntries"`
	MaxTagNameRunes       int    `json:"maxTagNameRunes"`
	MaxPropertyKeyRunes   int    `json:"maxPropertyKeyRunes"`
	MaxPropertyValueRunes int    `json:"maxPropertyValueRunes"`
	MaxEmojiRunes         int    `json:"maxEmojiRunes"`
	DefaultTagColor       string `json:"defaultTagColor"`
	MaxPathBytes          int    `json:"maxPathBytes"`
}

type AnnotationDocument struct {
	Revision    int64            `json:"revision"`
	UpdatedAt   time.Time        `json:"updatedAt"`
	Tags        []model.Tag      `json:"tags"`
	Properties  []model.Property `json:"properties"`
	Emoji       string           `json:"emoji"`
	FolderColor string           `json:"folderColor"`
}

type AnnotationSummary struct {
	EntryID     string      `json:"entryId"`
	Revision    int64       `json:"revision"`
	Tags        []model.Tag `json:"tags"`
	Emoji       string      `json:"emoji"`
	FolderColor string      `json:"folderColor"`
}

type EntryStatistics struct {
	Files        int   `json:"files"`
	Folders      int   `json:"folders"`
	Shortcuts    int   `json:"shortcuts"`
	LogicalBytes int64 `json:"logicalBytes"`
}

type AnnotationDetail struct {
	Entry       model.Entry        `json:"entry"`
	Breadcrumbs []model.Entry      `json:"breadcrumbs"`
	Annotation  AnnotationDocument `json:"annotation"`
	Limits      AnnotationLimits   `json:"limits"`
	Statistics  EntryStatistics    `json:"statistics"`
}

type AnnotationUpdate struct {
	ExpectedRevision int64            `json:"expectedRevision" minimum:"0" maximum:"9007199254740991"`
	Tags             []model.Tag      `json:"tags" maxItems:"8"`
	Properties       []model.Property `json:"properties" maxItems:"8"`
	Emoji            string           `json:"emoji" maxLength:"16"`
	FolderColor      string           `json:"folderColor" maxLength:"7"`
}

type AnnotationTarget struct {
	ID       string `json:"id" minLength:"1" maxLength:"36"`
	Revision int64  `json:"revision" minimum:"0" maximum:"9007199254740991"`
}

type TagsBatch struct {
	Targets []AnnotationTarget `json:"targets" minItems:"1" maxItems:"100"`
	Add     []model.Tag        `json:"add" maxItems:"8"`
	Remove  []string           `json:"remove" maxItems:"8"`
}

func (s *Service) annotationLimits() AnnotationLimits {
	return AnnotationLimits{MaxBytes: s.policy.AnnotationMaxBytes, MaxTags: model.MaxAnnotationTags, MaxProperties: model.MaxAnnotationProperties, MaxBatchEntries: s.policy.AnnotationBatchEntries, MaxTagNameRunes: model.MaxTagNameRunes, MaxPropertyKeyRunes: model.MaxPropertyKeyRunes, MaxPropertyValueRunes: model.MaxPropertyValueRunes, MaxEmojiRunes: model.MaxEmojiRunes, DefaultTagColor: model.DefaultTagColor, MaxPathBytes: MaxAnnotationPathBytes}
}

func annotationDocument(entry model.Entry) AnnotationDocument {
	return AnnotationDocument{Revision: entry.AnnotationRevision, UpdatedAt: entry.UpdatedAt, Tags: append([]model.Tag{}, entry.Annotations.Tags...), Properties: append([]model.Property{}, entry.Annotations.Properties...), Emoji: entry.Annotations.Emoji, FolderColor: entry.Annotations.FolderColor}
}

func annotationSummary(entry model.Entry) AnnotationSummary {
	return AnnotationSummary{EntryID: entry.ID, Revision: entry.AnnotationRevision, Tags: append([]model.Tag{}, entry.Annotations.Tags...), Emoji: entry.Annotations.Emoji, FolderColor: entry.Annotations.FolderColor}
}

// ReadAnnotationSummaries 只返回本屏显式目标；同一请求只扫描一次受控账号树。
func (s *Service) ReadAnnotationSummaries(ctx context.Context, owner string, ids []string, visibility AnnotationVisibility) ([]AnnotationSummary, error) {
	if owner == "" {
		return nil, model.ErrMissing
	}
	if len(ids) == 0 || len(ids) > MaxListPageSize {
		return nil, model.ErrTooLarge
	}
	if visibility == "" {
		visibility = AnnotationActive
	}
	if visibility != AnnotationActive && visibility != AnnotationTrash {
		return nil, model.ErrInvalid
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if id == "" || len(id) > 36 || seen[id] {
			return nil, model.ErrInvalid
		}
		seen[id] = true
	}
	entries, err := s.repo.ReadBounded(ctx, owner, s.policy.SearchTreeEntries)
	if err != nil {
		return nil, err
	}
	tree, err := newQueryTree(ctx, entries, "")
	if err != nil {
		return nil, err
	}
	result := make([]AnnotationSummary, 0, len(ids))
	for _, id := range ids {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		var entry model.Entry
		if visibility == AnnotationTrash {
			candidate, exists := tree.entries[id]
			if !exists || candidate.TrashedAt == nil {
				return nil, model.ErrMissing
			}
			entry = candidate
		} else {
			entry, err = visibleAnnotationEntry(ctx, tree, id)
			if err != nil {
				return nil, err
			}
		}
		result = append(result, annotationSummary(entry))
	}
	return result, nil
}

func (s *Service) normalizeAnnotations(value model.Annotations) (model.Annotations, error) {
	value = model.CloneAnnotations(value)
	for index := range value.Tags {
		value.Tags[index].Name = s.names.Normalize(value.Tags[index].Name)
		value.Tags[index].Color = strings.ToLower(value.Tags[index].Color)
	}
	for index := range value.Properties {
		value.Properties[index].Key = s.names.Normalize(value.Properties[index].Key)
		value.Properties[index].Value = s.names.Normalize(value.Properties[index].Value)
	}
	value.Emoji = s.names.Normalize(value.Emoji)
	value.FolderColor = strings.ToLower(value.FolderColor)
	if err := model.ValidateAnnotations(value, s.policy.AnnotationMaxBytes); err != nil {
		return model.Annotations{}, err
	}
	return value, nil
}

func visibleAnnotationEntry(ctx context.Context, tree *queryTree, id string) (model.Entry, error) {
	entry, exists := tree.entries[id]
	if !exists {
		return model.Entry{}, model.ErrMissing
	}
	visible, err := tree.walk(ctx, id, walkVisibility)
	if err != nil {
		return model.Entry{}, err
	}
	if !visible {
		return model.Entry{}, model.ErrMissing
	}
	return entry, nil
}

// ReadAnnotations 的统计只计算可见后代，引用不冒充文件字节。
func (s *Service) ReadAnnotations(ctx context.Context, owner, id string) (AnnotationDetail, error) {
	if owner == "" || id == "" {
		return AnnotationDetail{}, model.ErrMissing
	}
	entries, err := s.repo.ReadBounded(ctx, owner, s.policy.SearchTreeEntries)
	if err != nil {
		return AnnotationDetail{}, err
	}
	tree, err := newQueryTree(ctx, entries, id)
	if err != nil {
		return AnnotationDetail{}, err
	}
	entry, err := visibleAnnotationEntry(ctx, tree, id)
	if err != nil {
		return AnnotationDetail{}, err
	}
	result := AnnotationDetail{Entry: entry, Breadcrumbs: []model.Entry{}, Annotation: annotationDocument(entry), Limits: s.annotationLimits()}
	pathBytes := len(entry.Name) + 1
	for parent := entry.ParentID; parent != ""; {
		if err := ctx.Err(); err != nil {
			return AnnotationDetail{}, err
		}
		ancestor, exists := tree.entries[parent]
		if !exists {
			return AnnotationDetail{}, model.ErrMissing
		}
		pathBytes += len(ancestor.Name) + 1
		if pathBytes > MaxAnnotationPathBytes {
			return AnnotationDetail{}, model.ErrTooLarge
		}
		result.Breadcrumbs = append(result.Breadcrumbs, ancestor)
		parent = ancestor.ParentID
	}
	slices.Reverse(result.Breadcrumbs)
	for _, candidate := range entries {
		if err := ctx.Err(); err != nil {
			return AnnotationDetail{}, err
		}
		if entry.Kind != model.Folder {
			if candidate.ID != id {
				continue
			}
		} else {
			if candidate.ID == id {
				continue
			}
			visible, err := tree.walk(ctx, candidate.ID, walkVisibility)
			if err != nil {
				return AnnotationDetail{}, err
			}
			if !visible {
				continue
			}
			within, err := tree.walk(ctx, candidate.ID, walkDescendants)
			if err != nil {
				return AnnotationDetail{}, err
			}
			if !within {
				continue
			}
		}
		switch candidate.Kind {
		case model.Folder:
			result.Statistics.Folders++
		case model.Shortcut:
			result.Statistics.Shortcuts++
		case model.File:
			if candidate.SizeBytes < 0 || result.Statistics.LogicalBytes > math.MaxInt64-candidate.SizeBytes {
				return AnnotationDetail{}, model.ErrInvalid
			}
			result.Statistics.Files++
			result.Statistics.LogicalBytes += candidate.SizeBytes
		}
	}
	return result, nil
}

func sameAnnotations(left, right model.Annotations) bool {
	return left.Emoji == right.Emoji && left.FolderColor == right.FolderColor && slices.Equal(left.Tags, right.Tags) && slices.Equal(left.Properties, right.Properties)
}

func (s *Service) replaceEntryAnnotations(entry model.Entry, expected int64, value model.Annotations) (model.Entry, error) {
	if expected < 0 || expected > model.MaxAnnotationRevision {
		return model.Entry{}, model.ErrInvalid
	}
	if entry.AnnotationRevision != expected {
		return model.Entry{}, model.ErrConflict
	}
	if entry.Kind != model.Folder && value.FolderColor != "" {
		return model.Entry{}, model.ErrInvalid
	}
	if sameAnnotations(entry.Annotations, value) {
		return entry, nil
	}
	if entry.AnnotationRevision >= model.MaxAnnotationRevision {
		return model.Entry{}, model.ErrConflict
	}
	entry.Annotations = model.CloneAnnotations(value)
	entry.AnnotationRevision++
	entry.UpdatedAt = s.clock.Now().UTC()
	return entry, nil
}

func (s *Service) ReplaceAnnotations(ctx context.Context, owner, id string, input AnnotationUpdate) (AnnotationDocument, error) {
	if owner == "" || id == "" {
		return AnnotationDocument{}, model.ErrMissing
	}
	value, err := s.normalizeAnnotations(model.Annotations{Tags: input.Tags, Properties: input.Properties, Emoji: input.Emoji, FolderColor: input.FolderColor})
	if err != nil {
		return AnnotationDocument{}, err
	}
	changed, err := s.repo.ChangeManyBounded(ctx, owner, s.policy.SearchTreeEntries, func(entries []model.Entry) ([]model.Entry, error) {
		tree, err := newQueryTree(ctx, entries, "")
		if err != nil {
			return nil, err
		}
		entry, err := visibleAnnotationEntry(ctx, tree, id)
		if err != nil {
			return nil, err
		}
		entry, err = s.replaceEntryAnnotations(entry, input.ExpectedRevision, value)
		if err != nil {
			return nil, err
		}
		return []model.Entry{entry}, nil
	})
	if err != nil {
		return AnnotationDocument{}, err
	}
	return annotationDocument(changed[0]), nil
}

// ChangeTags 验证整批目标及结果后才保存；未命中的移除保持原值，不推进该条版本。
func (s *Service) ChangeTags(ctx context.Context, owner string, input TagsBatch) ([]AnnotationSummary, error) {
	if owner == "" {
		return nil, model.ErrMissing
	}
	if len(input.Targets) == 0 || len(input.Targets) > s.policy.AnnotationBatchEntries {
		return nil, model.ErrTooLarge
	}
	if len(input.Add) == 0 && len(input.Remove) == 0 {
		return nil, model.ErrInvalid
	}
	additions, err := s.normalizeAnnotations(model.Annotations{Tags: input.Add})
	if err != nil {
		return nil, err
	}
	if len(input.Remove) > model.MaxAnnotationTags {
		return nil, model.ErrTooLarge
	}
	removals := map[string]bool{}
	for _, name := range input.Remove {
		name = s.names.Normalize(name)
		key := strings.ToLower(name)
		if name == "" || strings.TrimSpace(name) != name || !model.ValidAnnotationText(name, model.MaxTagNameRunes) || removals[key] {
			return nil, model.ErrInvalid
		}
		removals[key] = true
	}
	for _, tag := range additions.Tags {
		if removals[strings.ToLower(tag.Name)] {
			return nil, model.ErrInvalid
		}
	}
	var result []AnnotationSummary
	_, err = s.repo.ChangeManyBounded(ctx, owner, s.policy.SearchTreeEntries, func(entries []model.Entry) ([]model.Entry, error) {
		tree, err := newQueryTree(ctx, entries, "")
		if err != nil {
			return nil, err
		}
		seen := map[string]bool{}
		changed := []model.Entry{}
		summaries := make([]AnnotationSummary, 0, len(input.Targets))
		for _, target := range input.Targets {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			if target.ID == "" || seen[target.ID] {
				return nil, model.ErrInvalid
			}
			seen[target.ID] = true
			entry, err := visibleAnnotationEntry(ctx, tree, target.ID)
			if err != nil {
				return nil, err
			}
			value := model.CloneAnnotations(entry.Annotations)
			value.Tags = []model.Tag{}
			existing := map[string]bool{}
			for _, tag := range entry.Annotations.Tags {
				key := strings.ToLower(tag.Name)
				if !removals[key] {
					value.Tags = append(value.Tags, tag)
					existing[key] = true
				}
			}
			for _, tag := range additions.Tags {
				key := strings.ToLower(tag.Name)
				if !existing[key] {
					value.Tags = append(value.Tags, tag)
					existing[key] = true
				}
			}
			if err := model.ValidateAnnotations(value, s.policy.AnnotationMaxBytes); err != nil {
				return nil, err
			}
			updated, err := s.replaceEntryAnnotations(entry, target.Revision, value)
			if err != nil {
				return nil, err
			}
			if updated.AnnotationRevision != entry.AnnotationRevision {
				changed = append(changed, updated)
			}
			summaries = append(summaries, annotationSummary(updated))
		}
		result = summaries
		return changed, nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}
