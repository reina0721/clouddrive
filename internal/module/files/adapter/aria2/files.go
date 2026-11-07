package aria2

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type canceledReader struct {
	ctx    context.Context
	reader io.Reader
}

type filePresence uint8

const (
	fileRequired filePresence = iota
	partialMayBeMissing
)

func (r canceledReader) Read(buffer []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	count, err := r.reader.Read(buffer)
	if err == nil || errors.Is(err, io.EOF) {
		return count, err
	}
	return count, nodeCause(err)
}

// withFile 的os.Root负责目录逃逸保护，逐段Lstat另外拒绝根内symlink。
// 所有句柄都由本调用创建并关闭，关闭失败不能覆盖主要读取错误。
func (c *Client) withFile(ctx context.Context, job service.TorrentJob, relative string, maxBytes int64, presence filePresence, consume func(io.Reader, int64) error) (returned error) {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := c.validateJob(job); err != nil {
		return err
	}
	if consume == nil || maxBytes < 0 || relative == "." || !filepath.IsLocal(relative) || strings.Contains(relative, "\\") || len(relative) > service.MaxTorrentPathBytes {
		return service.ErrTorrentBinding
	}
	workspace, err := os.OpenRoot(c.config.WorkspaceRoot)
	if err != nil {
		return &service.TorrentError{Kind: service.ErrTorrentNode, Cause: err}
	}
	defer func() { returned = errors.Join(returned, nodeCause(workspace.Close())) }()
	jobDirectory, err := workspace.Lstat(job.GID)
	if err != nil {
		if presence == partialMayBeMissing && errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return &service.TorrentError{Kind: service.ErrTorrentNode, Cause: err}
	}
	if !jobDirectory.IsDir() || jobDirectory.Mode()&os.ModeSymlink != 0 {
		return service.ErrTorrentBinding
	}
	root, err := workspace.OpenRoot(job.GID)
	if err != nil {
		if presence == partialMayBeMissing && errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return &service.TorrentError{Kind: service.ErrTorrentNode, Cause: err}
	}
	defer func() { returned = errors.Join(returned, nodeCause(root.Close())) }()
	segments := strings.Split(relative, "/")
	for index, segment := range segments {
		if segment == "" || segment == "." || segment == ".." {
			return service.ErrTorrentBinding
		}
		entry, err := root.Lstat(filepath.Join(segments[:index+1]...))
		if err != nil {
			if presence == partialMayBeMissing && errors.Is(err, os.ErrNotExist) {
				return nil
			}
			return &service.TorrentError{Kind: service.ErrTorrentNode, Cause: err}
		}
		if entry.Mode()&os.ModeSymlink != 0 || (index < len(segments)-1 && !entry.IsDir()) {
			return service.ErrTorrentBinding
		}
	}
	file, err := root.Open(filepath.FromSlash(relative))
	if err != nil {
		if presence == partialMayBeMissing && errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return &service.TorrentError{Kind: service.ErrTorrentNode, Cause: err}
	}
	defer func() { returned = errors.Join(returned, nodeCause(file.Close())) }()
	stat, err := file.Stat()
	if err != nil {
		return &service.TorrentError{Kind: service.ErrTorrentNode, Cause: err}
	}
	if !stat.Mode().IsRegular() || stat.Size() < 0 || stat.Size() > maxBytes {
		return service.ErrTorrentBinding
	}
	return consume(canceledReader{ctx: ctx, reader: io.LimitReader(file, maxBytes+1)}, stat.Size())
}

func (c *Client) ReadMetadata(ctx context.Context, job service.TorrentJob, infoHash string) ([]byte, error) {
	if job.Phase != service.TorrentJobMetadata {
		return nil, service.ErrTorrentBinding
	}
	digest, err := hex.DecodeString(infoHash)
	if err != nil || len(digest) != sha1.Size || infoHash != strings.ToLower(infoHash) {
		return nil, service.ErrTorrentMetadata
	}
	progress, err := c.Progress(ctx, job)
	if err != nil {
		return nil, err
	}
	if progress.State != service.TorrentNodeComplete {
		return nil, service.ErrTorrentProtocol
	}
	var raw []byte
	err = c.withFile(ctx, job, infoHash+".torrent", service.MaxTorrentMetadataBytes, fileRequired, func(reader io.Reader, size int64) error {
		content, err := io.ReadAll(reader)
		if err != nil {
			return err
		}
		if int64(len(content)) != size || len(content) > service.MaxTorrentMetadataBytes {
			return service.ErrTorrentMetadata
		}
		metadata, err := c.decoder.Decode(content)
		if err != nil {
			return err
		}
		if metadata.InfoHash != infoHash {
			return service.ErrTorrentMetadata
		}
		raw = content
		return nil
	})
	if err != nil {
		return nil, err
	}
	return raw, nil
}

func (c *Client) OpenCompleted(ctx context.Context, job service.TorrentJob, expected service.TorrentFile, consume func(io.Reader) error) error {
	if job.Phase != service.TorrentJobPayload {
		return service.ErrTorrentBinding
	}
	if consume == nil {
		return service.ErrTorrentBinding
	}
	progress, err := c.Progress(ctx, job)
	if err != nil {
		return err
	}
	if progress.State != service.TorrentNodeComplete || progress.ReceivedBytes != progress.TotalBytes || progress.ReceivedBytes < expected.SizeBytes {
		return service.ErrTorrentProtocol
	}
	matched := false
	for _, file := range progress.Files {
		if file.Index == expected.Index && file.Path == expected.Path && file.SizeBytes == expected.SizeBytes && file.Selected {
			matched = true
		}
	}
	if !matched {
		return service.ErrTorrentBinding
	}
	return c.withFile(ctx, job, expected.Path, expected.SizeBytes, fileRequired, func(reader io.Reader, size int64) error {
		if size != expected.SizeBytes {
			return service.ErrTorrentBinding
		}
		return consume(reader)
	})
}
