package archiveprocess

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"hash/crc32"
	"io"
	"io/fs"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/bodgit/sevenzip"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

func validateRequest(q service.ArchiveParseRequest) error {
	if q.MaxBytes < 1 || q.MaxBytes > service.DefaultMaxArchiveBytes || int64(len(q.Content)) > q.MaxBytes || q.MaxMembers < 1 || q.MaxMembers > service.DefaultMaxBatchEntries {
		return model.ErrTooLarge
	}
	if len(q.Password) > service.MaxArchivePasswordBytes || !utf8.ValidString(q.Password) {
		return model.ErrInvalid
	}
	switch q.Mode {
	case service.ArchiveInspect, service.ArchiveReadAll:
		if len(q.Paths) != 0 {
			return model.ErrInvalid
		}
	case service.ArchiveReadSelected:
		if len(q.Paths) == 0 || len(q.Paths) > q.MaxMembers {
			return model.ErrInvalid
		}
	default:
		return model.ErrInvalid
	}
	for _, name := range q.Paths {
		if len(name) > service.MaxArchivePathBytes || !fs.ValidPath(name) || strings.Contains(name, "\\") {
			return model.ErrInvalid
		}
	}
	return nil
}

type memberSource struct {
	open     func() (io.ReadCloser, error)
	checksum uint32
}
type archiveIndex struct {
	members    map[string]service.ArchiveMember
	explicit   map[string]bool
	sources    map[string]memberSource
	total      int64
	maxBytes   int64
	maxMembers int
}

func (i *archiveIndex) add(name string, mode fs.FileMode, size uint64, open func() (io.ReadCloser, error)) error {
	if !mode.IsRegular() && !mode.IsDir() {
		return model.ErrUnsupported
	}
	folder := mode.IsDir() || strings.HasSuffix(name, "/")
	name = strings.TrimSuffix(name, "/")
	if !utf8.ValidString(name) || !fs.ValidPath(name) || strings.Contains(name, "\\") || len(name) > service.MaxArchivePathBytes {
		return model.ErrInvalid
	}
	parts := strings.Split(name, "/")
	if len(parts) > service.MaxArchiveDepth {
		return model.ErrTooLarge
	}
	if len(parts[0]) >= 2 && parts[0][1] == ':' {
		return model.ErrInvalid
	}
	for _, part := range parts {
		if err := model.ValidateName(part); err != nil {
			return err
		}
	}
	if size > uint64(i.maxBytes-i.total) {
		return model.ErrTooLarge
	}
	if folder && size != 0 {
		return model.ErrInvalid
	}
	for n := 1; n < len(parts); n++ {
		parent := strings.Join(parts[:n], "/")
		if existing, ok := i.members[parent]; ok && existing.Kind != model.Folder {
			return model.ErrInvalid
		}
		i.members[parent] = service.ArchiveMember{Path: parent, Kind: model.Folder}
	}
	if existing, ok := i.members[name]; ok && (i.explicit[name] || !folder || existing.Kind != model.Folder) {
		return model.ErrInvalid
	}
	kind := model.File
	if folder {
		kind = model.Folder
	} else {
		i.sources[name] = memberSource{open: open}
	}
	i.members[name] = service.ArchiveMember{Path: name, Kind: kind, SizeBytes: int64(size)}
	i.explicit[name] = true
	i.total += int64(size)
	if len(i.members) > i.maxMembers {
		return model.ErrTooLarge
	}
	return nil
}
func selected(name string, roots []string) bool {
	for _, root := range roots {
		if name == root || strings.HasPrefix(name, root+"/") {
			return true
		}
	}
	return false
}
func parse(ctx context.Context, q service.ArchiveParseRequest) (service.ArchiveParseResult, error) {
	result := service.ArchiveParseResult{Members: []service.ArchiveMember{}, Payloads: []service.ArchivePayload{}}
	if err := validateRequest(q); err != nil {
		return result, err
	}
	if err := ctx.Err(); err != nil {
		return result, err
	}
	index := archiveIndex{members: map[string]service.ArchiveMember{}, explicit: map[string]bool{}, sources: map[string]memberSource{}, maxBytes: q.MaxBytes, maxMembers: q.MaxMembers}
	input := bytes.NewReader(q.Content)
	switch {
	case len(q.Content) >= 4 && q.Content[0] == 'P' && q.Content[1] == 'K':
		reader, err := zip.NewReader(input, int64(input.Len()))
		if err != nil {
			return result, err
		}
		if len(reader.File) > q.MaxMembers {
			return result, model.ErrTooLarge
		}
		result.Format = "zip"
		for _, file := range reader.File {
			if file.Flags&1 != 0 {
				return result, model.ErrUnsupported
			}
			if file.Method != zip.Store && file.Method != zip.Deflate {
				return result, model.ErrUnsupported
			}
			if err := index.add(file.Name, file.Mode(), file.UncompressedSize64, file.Open); err != nil {
				return result, err
			}
		}
	case bytes.HasPrefix(q.Content, []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c}):
		reader, err := sevenzip.NewReaderWithPassword(input, int64(input.Len()), q.Password)
		if err != nil {
			return result, classifySevenZip(err)
		}
		if len(reader.File) > q.MaxMembers {
			return result, model.ErrTooLarge
		}
		result.Format = "7z"
		for _, file := range reader.File {
			if err := index.add(file.Name, file.Mode(), file.UncompressedSize, file.Open); err != nil {
				return result, err
			}
			if source, ok := index.sources[strings.TrimSuffix(file.Name, "/")]; ok {
				source.checksum = file.CRC32
				index.sources[strings.TrimSuffix(file.Name, "/")] = source
			}
		}
	default:
		return result, model.ErrUnsupported
	}
	for _, root := range q.Paths {
		if _, ok := index.members[root]; !ok {
			return result, model.ErrMissing
		}
	}
	for _, m := range index.members {
		result.Members = append(result.Members, m)
	}
	sort.Slice(result.Members, func(i, j int) bool { return result.Members[i].Path < result.Members[j].Path })
	if q.Mode == service.ArchiveInspect {
		return result, nil
	}
	for _, member := range result.Members {
		if member.Kind == model.Folder || (q.Mode == service.ArchiveReadSelected && !selected(member.Path, q.Paths)) {
			continue
		}
		if err := ctx.Err(); err != nil {
			return result, err
		}
		reader, err := index.sources[member.Path].open()
		if err != nil {
			return result, classifySevenZip(err)
		}
		content, readErr := io.ReadAll(io.LimitReader(reader, member.SizeBytes+1))
		closeErr := reader.Close()
		if err := errors.Join(readErr, closeErr); err != nil {
			return result, classifySevenZip(err)
		}
		if int64(len(content)) != member.SizeBytes {
			return result, model.ErrInvalid
		}
		// sevenzip公开的成员reader不核验单文件CRC，必须在交付前补齐。
		if result.Format == "7z" && crc32.ChecksumIEEE(content) != index.sources[member.Path].checksum {
			return result, service.ErrArchiveChecksum
		}
		result.Payloads = append(result.Payloads, service.ArchivePayload{Path: member.Path, Content: content})
	}
	return result, nil
}
func classifySevenZip(err error) error {
	var readError *sevenzip.ReadError
	if errors.As(err, &readError) && readError.Encrypted {
		return errors.Join(service.ErrArchivePassword, err)
	}
	return err
}
