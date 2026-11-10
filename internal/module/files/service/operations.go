package service

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"path"
	"slices"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const editedTextMediaType = "text/plain; charset=utf-8"
const drawioExtension = "drawio"
const drawioMediaType = "application/xml"

var privateTextExtensions = []string{
	"txt", "md", "markdown", "csv", "json", "jsonc", "xml", "html", "htm", "css", "js", "mjs", "cjs",
	"ts", "tsx", "jsx", "yaml", "yml", "toml", "ini", "log", "go", "py", "rs", "sh", "bash", "sql",
	"java", "c", "cpp", "h", "hpp", "rb", "php", "ps1",
}

// CreateText 为小型纯文本创建提供明确入口，普通文件统一使用持久传输。
func (s *Service) CreateText(ctx context.Context, owner, parent, name, key, text string) (model.Entry, error) {
	content := []byte(text)
	if !utf8.Valid(content) || strings.ContainsRune(text, 0) {
		return model.Entry{}, model.ErrInvalid
	}
	if int64(len(content)) > s.policy.MaxTextBytes {
		return model.Entry{}, model.ErrTooLarge
	}
	return s.createSmallContent(ctx, owner, parent, name, key, content)
}

// Within 判断目录项是否位于指定根（含根本身），父链异常时拒绝访问。
func Within(entries []model.Entry, root, id string) bool {
	for remaining := len(entries) + 1; id != "" && remaining > 0; remaining-- {
		if id == root {
			return true
		}
		entry, ok := model.Find(entries, id)
		if !ok {
			return false
		}
		id = entry.ParentID
	}
	return false
}

// Copy 通过单次批量事务复制有效子树；共享不可变内容，不共享可变目录项。
func (s *Service) Copy(ctx context.Context, owner, id, parent, name string) (model.Entry, error) {
	normalized, err := s.normalizedName(name)
	if err != nil {
		return model.Entry{}, err
	}
	changed, err := s.repo.ChangeMany(ctx, owner, func(entries []model.Entry) ([]model.Entry, error) {
		return s.copyTree(entries, id, parent, name, normalized, CopyRecursive)
	})
	if err != nil {
		return model.Entry{}, err
	}
	if len(changed) == 0 {
		return model.Entry{}, fmt.Errorf("file copy produced no root")
	}
	return changed[0], nil
}

// ReplaceText 用内容版本号执行比较并交换，不删除可能被副本引用的旧对象。
func (s *Service) ReplaceText(ctx context.Context, owner, id string, revision int64, text string) (model.Entry, error) {
	if revision < 1 || !utf8.ValidString(text) || strings.IndexByte(text, 0) >= 0 {
		return model.Entry{}, model.ErrInvalid
	}
	if int64(len(text)) > s.policy.MaxTextBytes || int64(len(text)) > s.policy.MaxFileBytes {
		return model.Entry{}, model.ErrTooLarge
	}
	detail, err := s.Detail(ctx, owner, id)
	if err != nil {
		return model.Entry{}, err
	}
	if !detail.TextEditable {
		if detail.Entry.Kind == model.Shortcut {
			return model.Entry{}, model.ErrUnsupported
		}
		return model.Entry{}, model.ErrInvalid
	}
	if detail.Entry.ContentRevision != revision {
		return model.Entry{}, model.ErrConflict
	}
	if err := s.policy.NameAdmission.validate(detail.Entry.Name); err != nil {
		return model.Entry{}, err
	}
	objectID, err := s.ids.New()
	if err != nil {
		return model.Entry{}, err
	}
	key := "files/" + objectID
	mediaType := utf8TextMediaType(detail.Entry.MediaType)
	if strings.EqualFold(path.Ext(detail.Entry.Name), "."+drawioExtension) {
		mediaType = drawioMediaType
	}
	if err := s.content.Put(ctx, key, []byte(text), mediaType); err != nil {
		return model.Entry{}, s.compensate(ctx, owner, key, fmt.Errorf("write text candidate: %w", err))
	}
	digest := sha256.Sum256([]byte(text))
	entry, err := s.repo.ChangeContent(ctx, owner, func(snapshot ContentSnapshot) (model.Entry, error) {
		entries := snapshot.Entries
		current, ok := model.Find(entries, id)
		if !ok || !model.Visible(entries, current) {
			return model.Entry{}, model.ErrMissing
		}
		if current.ContentRevision != revision || current.ObjectKey != detail.Entry.ObjectKey {
			return model.Entry{}, model.ErrConflict
		}
		if err := s.policy.NameAdmission.validate(current.Name); err != nil {
			return model.Entry{}, err
		}
		prepared, err := s.prepareReplacement(entries, current, snapshot.HistoryPreferences)
		if err != nil {
			return model.Entry{}, err
		}
		used := s.replacementUsed(entries, current, prepared)
		if used > s.policy.QuotaBytes || int64(len(text)) > s.policy.QuotaBytes-used {
			return model.Entry{}, model.ErrQuota
		}
		if current.ContentRevision >= model.MaxContentRevision {
			return model.Entry{}, model.ErrConflict
		}
		current = prepared
		current.ObjectKey, current.ContentSHA, current.SizeBytes = key, hex.EncodeToString(digest[:]), int64(len(text))
		current.MediaType = mediaType
		current.ContentRevision++
		current.UploadKey = ""
		current.UpdatedAt = s.clock.Now().UTC()
		return current, nil
	})
	if err != nil {
		return model.Entry{}, s.compensate(ctx, owner, key, err)
	}
	return entry, nil
}

func editableText(entry model.Entry) bool {
	return strings.HasPrefix(entry.MediaType, "text/") || strings.EqualFold(path.Ext(entry.Name), ".md") || strings.EqualFold(path.Ext(entry.Name), ".txt")
}

func editablePrivateText(entry model.Entry) bool {
	if entry.Kind != model.File || entry.TrashedAt != nil {
		return false
	}
	extension := strings.TrimPrefix(strings.ToLower(path.Ext(entry.Name)), ".")
	return editableText(entry) || extension == drawioExtension || slices.Contains(privateTextExtensions, extension)
}

func utf8TextMediaType(previous string) string {
	mediaType, parameters, err := mime.ParseMediaType(previous)
	if err != nil {
		return editedTextMediaType
	}
	switch mediaType {
	case "application/json", "application/javascript", "application/xml", "application/yaml", "application/toml":
	default:
		if !strings.HasPrefix(mediaType, "text/") {
			return editedTextMediaType
		}
	}
	if _, hasCharset := parameters["charset"]; !hasCharset {
		return previous
	}
	parameters["charset"] = "utf-8"
	return mime.FormatMediaType(mediaType, parameters)
}

// Archive 先校验完整选择集与预算，再生成有界 ZIP；任何读取或关闭错误均返回失败。
func (s *Service) Archive(ctx context.Context, owner string, ids []string) ([]byte, error) {
	if len(ids) == 0 || len(ids) > s.policy.MaxBatchEntries {
		return nil, model.ErrInvalid
	}
	entries, err := s.read(ctx, owner)
	if err != nil {
		return nil, err
	}
	members, err := s.archiveMembers(ctx, entries, ids)
	if err != nil {
		return nil, err
	}
	var output bytes.Buffer
	if err := s.writeArchive(ctx, owner, members, &output, zip.Store); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

type zipMember struct {
	entry model.Entry
	name  string
}

func (s *Service) archiveMembers(ctx context.Context, entries []model.Entry, ids []string) ([]zipMember, error) {
	if len(ids) == 0 || len(ids) > s.policy.MaxBatchEntries {
		return nil, model.ErrInvalid
	}
	tree, err := newQueryTree(ctx, entries, "")
	if err != nil {
		return nil, err
	}
	selected := make(map[string]bool, len(ids))
	for _, id := range ids {
		visible, err := tree.walk(ctx, id, walkVisibility)
		if err != nil {
			return nil, err
		}
		if !visible {
			return nil, model.ErrMissing
		}
		selected[id] = true
	}
	for id := range selected {
		for parent := tree.entries[id].ParentID; parent != ""; parent = tree.entries[parent].ParentID {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			if selected[parent] {
				delete(selected, id)
				break
			}
		}
	}
	children := make(map[string][]model.Entry)
	for _, entry := range entries {
		if entry.TrashedAt == nil {
			children[entry.ParentID] = append(children[entry.ParentID], entry)
		}
	}
	pending := make([]zipMember, 0, len(selected))
	for id := range selected {
		entry := tree.entries[id]
		pending = append(pending, zipMember{entry: entry, name: entry.Name})
	}
	members := []zipMember{}
	names := map[string]bool{}
	remaining := s.policy.MaxArchiveBytes
	for len(pending) > 0 {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		member := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		if !fs.ValidPath(member.name) || strings.ContainsRune(member.name, '\\') {
			return nil, model.ErrInvalid
		}
		switch member.entry.Kind {
		case model.Folder:
			member.name += "/"
			for _, child := range children[member.entry.ID] {
				pending = append(pending, zipMember{entry: child, name: member.name + child.Name})
			}
		case model.File:
		default:
			return nil, model.ErrUnsupported
		}
		if names[member.name] {
			return nil, model.ErrConflict
		}
		names[member.name] = true
		if member.entry.SizeBytes < 0 || member.entry.SizeBytes > remaining {
			return nil, model.ErrTooLarge
		}
		remaining -= member.entry.SizeBytes
		members = append(members, member)
		if len(members) > s.policy.MaxBatchEntries {
			return nil, model.ErrTooLarge
		}
	}
	sort.Slice(members, func(i, j int) bool { return members[i].name < members[j].name })
	return members, nil
}

func (s *Service) writeArchive(ctx context.Context, owner string, members []zipMember, output io.Writer, method uint16) error {
	writer := zip.NewWriter(output)
	for _, member := range members {
		if err := ctx.Err(); err != nil {
			return errors.Join(err, writer.Close())
		}
		var content []byte
		memberMethod := uint16(zip.Store)
		if member.entry.Kind == model.File {
			current, payload, err := s.ReadSmall(ctx, owner, member.entry.ID, s.policy.MaxArchiveBytes)
			if err != nil {
				return errors.Join(err, writer.Close())
			}
			if current.ObjectKey != member.entry.ObjectKey || current.ContentRevision != member.entry.ContentRevision {
				return errors.Join(model.ErrConflict, writer.Close())
			}
			content = payload
			memberMethod = method
		}
		header := &zip.FileHeader{Name: member.name, Method: memberMethod, Modified: member.entry.UpdatedAt}
		part, err := writer.CreateHeader(header)
		if err != nil {
			return errors.Join(err, writer.Close())
		}
		if _, err := part.Write(content); err != nil {
			return errors.Join(err, writer.Close())
		}
	}
	return writer.Close()
}

// CopyDepth 限定WebDAV浅复制或现有完整子树复制。
type CopyDepth string

const (
	CopyRecursive CopyDepth = "recursive"
	CopyShallow   CopyDepth = "shallow"
)

// copyTree 生成单次事务的副本集合，不提前写入或删除目的条目。
func (s *Service) copyTree(entries []model.Entry, id, parent, name, normalized string, depth CopyDepth) ([]model.Entry, error) {
	if depth != CopyRecursive && depth != CopyShallow {
		return nil, model.ErrInvalid
	}

	source, ok := model.Find(entries, id)
	if !ok || !model.Visible(entries, source) {
		return nil, model.ErrMissing
	}
	if err := model.Parent(entries, parent); err != nil {
		return nil, err
	}
	if source.Kind == model.Folder && Within(entries, id, parent) {
		return nil, model.ErrConflict
	}
	if err := model.Available(entries, "", parent, normalized); err != nil {
		return nil, err
	}
	originals := []model.Entry{source}
	for _, entry := range entries {
		if depth == CopyRecursive && entry.ID != id && model.Visible(entries, entry) && Within(entries, id, entry.ID) {
			originals = append(originals, entry)
		}
	}
	if len(originals) > s.policy.MaxBatchEntries {
		return nil, model.ErrTooLarge
	}
	if additions := shortcutCount(originals); additions > 0 && shortcutCount(entries)+additions > s.policy.ShortcutLimit {
		return nil, model.ErrTooLarge
	}
	remaining := s.policy.QuotaBytes - model.Used(entries)
	if model.HistoryCount(entries)+model.HistoryCount(originals) > s.policy.HistoryPerOwner {
		return nil, model.ErrHistoryFull
	}
	for _, entry := range originals {
		if len(entry.History) > s.policy.HistoryPerFile {
			return nil, model.ErrHistoryFull
		}
		size := entry.SizeBytes + model.HistoryBytes(entry)
		if size < 0 || size > remaining {
			return nil, model.ErrQuota
		}
		remaining -= size
	}
	ids := make(map[string]string, len(originals))
	allocated := make(map[string]bool, len(originals))
	for _, entry := range originals {
		generated, err := s.ids.New()
		if err != nil {
			return nil, err
		}
		if _, exists := model.Find(entries, generated); exists || generated == "" || allocated[generated] {
			return nil, model.ErrConflict
		}
		allocated[generated] = true
		ids[entry.ID] = generated
	}
	result := make([]model.Entry, 0, len(originals))
	now := s.clock.Now().UTC()
	for index, entry := range originals {
		originalID := entry.ID
		entry.ID, entry.CreatedAt, entry.UpdatedAt = ids[originalID], now, now
		entry.UploadKey, entry.TrashedAt = "", nil
		entry.AccessPolicy = model.CloneAccessPolicy(entry.AccessPolicy)
		entry.AccessPolicyRevision = 0
		entry.History = model.CloneHistory(entry.History)
		if len(entry.History) == 0 {
			entry.ContentRevision = 1
		}
		entry.HistoryRevision = 0
		entry.Annotations = model.CloneAnnotations(entry.Annotations)
		entry.AnnotationRevision = 0
		if index == 0 {
			entry.ParentID, entry.Name, entry.NormalizedName = parent, name, normalized
		} else {
			mapped, ok := ids[entry.ParentID]
			if !ok {
				return nil, model.ErrConflict
			}
			entry.ParentID = mapped
		}
		result = append(result, entry)
	}
	return result, nil
}
