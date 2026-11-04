package service

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"path"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// Archives 拥有本人压缩包的选择、预算和发布，解码由窄契约注入。
type Archives struct {
	files     *Service
	processor ArchiveProcessor
}

// NewArchives 复用文件服务的存储、配额与事务，不另建客户端或后台任务。
func NewArchives(files *Service, processor ArchiveProcessor) (*Archives, error) {
	if files == nil || processor == nil {
		return nil, fmt.Errorf("archive dependencies incomplete")
	}
	return &Archives{files, processor}, nil
}
func archiveChosen(member string, selected []string) bool {
	for _, root := range selected {
		if member == root || strings.HasPrefix(member, root+"/") {
			return true
		}
	}
	return false
}
func (a *Archives) validateSelection(selection ArchiveSelection) error {
	if selection.Mode == ArchiveReadAll && len(selection.Paths) == 0 {
		return nil
	}
	if selection.Mode != ArchiveReadSelected || len(selection.Paths) == 0 || len(selection.Paths) > a.files.policy.MaxBatchEntries {
		return model.ErrInvalid
	}
	for _, name := range selection.Paths {
		if !fs.ValidPath(name) || strings.Contains(name, "\\") || len(name) > MaxArchivePathBytes {
			return model.ErrInvalid
		}
	}
	return nil
}
func (a *Archives) validateParsed(result ArchiveParseResult) error {
	if result.Format != "zip" && result.Format != "7z" {
		return model.ErrUnsupported
	}
	if len(result.Members) > a.files.policy.MaxBatchEntries {
		return model.ErrTooLarge
	}
	kinds := make(map[string]model.Kind, len(result.Members))
	canonical := make(map[string]bool, len(result.Members))
	var total int64
	for _, member := range result.Members {
		if !fs.ValidPath(member.Path) || strings.Contains(member.Path, "\\") || len(member.Path) > MaxArchivePathBytes || !utf8.ValidString(member.Path) {
			return model.ErrInvalid
		}
		parts := strings.Split(member.Path, "/")
		if len(parts) > MaxArchiveDepth {
			return model.ErrTooLarge
		}
		if len(parts[0]) >= 2 && parts[0][1] == ':' {
			return model.ErrInvalid
		}
		normalized := make([]string, len(parts))
		for i, name := range parts {
			value, err := a.files.normalizedName(name)
			if err != nil {
				return err
			}
			normalized[i] = value
		}
		key := strings.Join(normalized, "/")
		if canonical[key] {
			return model.ErrConflict
		}
		canonical[key] = true
		if member.Kind != model.File && member.Kind != model.Folder {
			return model.ErrUnsupported
		}
		if member.SizeBytes < 0 || member.SizeBytes > a.files.policy.MaxFileBytes || member.SizeBytes > a.files.policy.MaxArchiveBytes-total {
			return model.ErrTooLarge
		}
		if member.Kind == model.Folder && member.SizeBytes != 0 {
			return model.ErrInvalid
		}
		total += member.SizeBytes
		kinds[member.Path] = member.Kind
	}
	for name := range kinds {
		if parent := path.Dir(name); parent != "." && kinds[parent] != model.Folder {
			return model.ErrInvalid
		}
	}
	payloads := make(map[string]bool, len(result.Payloads))
	sizes := make(map[string]int64, len(result.Members))
	for _, m := range result.Members {
		sizes[m.Path] = m.SizeBytes
	}
	for _, payload := range result.Payloads {
		if payloads[payload.Path] || kinds[payload.Path] != model.File || int64(len(payload.Content)) != sizes[payload.Path] {
			return model.ErrInvalid
		}
		payloads[payload.Path] = true
	}
	return nil
}
func (a *Archives) source(ctx context.Context, owner, id string, revision int64) (model.Entry, error) {
	if revision < 1 {
		return model.Entry{}, model.ErrInvalid
	}
	entries, err := a.files.repo.ReadBounded(ctx, owner, a.files.policy.SearchTreeEntries)
	if err != nil {
		return model.Entry{}, err
	}
	entry, ok := model.Find(entries, id)
	if !ok || !model.Visible(entries, entry) {
		return model.Entry{}, model.ErrMissing
	}
	if entry.Kind != model.File {
		return model.Entry{}, model.ErrUnsupported
	}
	if entry.ContentRevision != revision {
		return model.Entry{}, model.ErrConflict
	}
	return entry, nil
}
func (a *Archives) parse(ctx context.Context, owner, id string, revision int64, password string, selection ArchiveSelection) (model.Entry, ArchiveParseResult, error) {
	if !utf8.ValidString(password) || len(password) > MaxArchivePasswordBytes {
		return model.Entry{}, ArchiveParseResult{}, model.ErrInvalid
	}
	if selection.Mode != ArchiveInspect {
		if err := a.validateSelection(selection); err != nil {
			return model.Entry{}, ArchiveParseResult{}, err
		}
	}
	source, err := a.source(ctx, owner, id, revision)
	if err != nil {
		return model.Entry{}, ArchiveParseResult{}, err
	}
	current, content, err := a.files.ReadSmall(ctx, owner, id, a.files.policy.MaxArchiveBytes)
	if err != nil {
		return model.Entry{}, ArchiveParseResult{}, err
	}
	if current.ObjectKey != source.ObjectKey || current.ContentRevision != revision {
		return model.Entry{}, ArchiveParseResult{}, model.ErrConflict
	}
	result, err := a.processor.Process(ctx, ArchiveParseRequest{Content: content, Password: password, Mode: selection.Mode, Paths: selection.Paths, MaxBytes: a.files.policy.MaxArchiveBytes, MaxMembers: a.files.policy.MaxBatchEntries})
	if err != nil {
		return model.Entry{}, ArchiveParseResult{}, err
	}
	if err := a.validateParsed(result); err != nil {
		return model.Entry{}, ArchiveParseResult{}, err
	}
	known := map[string]bool{}
	for _, m := range result.Members {
		known[m.Path] = true
	}
	for _, name := range selection.Paths {
		if !known[name] {
			return model.Entry{}, ArchiveParseResult{}, model.ErrMissing
		}
	}
	payloads := map[string]bool{}
	for _, p := range result.Payloads {
		payloads[p.Path] = true
		if selection.Mode == ArchiveInspect || (selection.Mode == ArchiveReadSelected && !archiveChosen(p.Path, selection.Paths)) {
			return model.Entry{}, ArchiveParseResult{}, model.ErrInvalid
		}
	}
	if selection.Mode != ArchiveInspect {
		for _, m := range result.Members {
			if m.Kind == model.File && (selection.Mode == ArchiveReadAll || archiveChosen(m.Path, selection.Paths)) && !payloads[m.Path] {
				return model.Entry{}, ArchiveParseResult{}, model.ErrInvalid
			}
		}
	}
	latest, err := a.source(ctx, owner, id, revision)
	if err != nil {
		return model.Entry{}, ArchiveParseResult{}, err
	}
	if latest.ObjectKey != source.ObjectKey {
		return model.Entry{}, ArchiveParseResult{}, model.ErrConflict
	}
	return source, result, nil
}

// Inspect 返回当前源版本的虚拟清单，包含隐式目录；密码仅用于本次解析。
func (a *Archives) Inspect(ctx context.Context, owner, id string, revision int64, password string) (ArchiveManifest, error) {
	source, result, err := a.parse(ctx, owner, id, revision, password, ArchiveSelection{Mode: ArchiveInspect})
	if err != nil {
		return ArchiveManifest{}, err
	}
	var total int64
	for _, m := range result.Members {
		total += m.SizeBytes
	}
	p := a.files.policy
	return ArchiveManifest{Entry: source, Format: result.Format, Members: result.Members, TotalBytes: total, MaxBytes: p.MaxArchiveBytes, MaxMembers: p.MaxBatchEntries, MaxTextBytes: p.MaxTextBytes, MaxImageBytes: p.MaxThumbnailBytes}, nil
}

// Member 读取单个文件并校验实际大小与校验和，不接受目录作为字节内容。
func (a *Archives) Member(ctx context.Context, owner, id string, revision int64, password, name string) ([]byte, error) {
	_, result, err := a.parse(ctx, owner, id, revision, password, ArchiveSelection{Mode: ArchiveReadSelected, Paths: []string{name}})
	if err != nil {
		return nil, err
	}
	for _, p := range result.Payloads {
		if p.Path == name {
			return p.Content, nil
		}
	}
	return nil, model.ErrInvalid
}

// Download 将已校验成员重新打包，保留相对路径且约束最终ZIP大小。
func (a *Archives) Download(ctx context.Context, owner, id string, revision int64, password string, selection ArchiveSelection) ([]byte, error) {
	_, result, err := a.parse(ctx, owner, id, revision, password, selection)
	if err != nil {
		return nil, err
	}
	payloads := map[string][]byte{}
	for _, p := range result.Payloads {
		payloads[p.Path] = p.Content
	}
	var output bytes.Buffer
	writer := zip.NewWriter(&output)
	sort.Slice(result.Members, func(i, j int) bool { return result.Members[i].Path < result.Members[j].Path })
	for _, member := range result.Members {
		if selection.Mode == ArchiveReadSelected && !archiveChosen(member.Path, selection.Paths) {
			continue
		}
		if err := ctx.Err(); err != nil {
			return nil, errors.Join(err, writer.Close())
		}
		name := member.Path
		if member.Kind == model.Folder {
			name += "/"
		}
		part, err := writer.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Store})
		if err != nil {
			return nil, errors.Join(err, writer.Close())
		}
		if _, err := part.Write(payloads[member.Path]); err != nil {
			return nil, errors.Join(err, writer.Close())
		}
		if int64(output.Len()) > a.files.policy.MaxArchiveBytes {
			return nil, errors.Join(model.ErrTooLarge, writer.Close())
		}
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}
	if int64(output.Len()) > a.files.policy.MaxArchiveBytes {
		return nil, model.ErrTooLarge
	}
	return output.Bytes(), nil
}
