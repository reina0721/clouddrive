package aria2

import (
	"context"
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

// PrepareRoot 属于候选准入I/O，不在New或普通查询中创建下载目录。
func PrepareRoot(ctx context.Context, config service.TorrentNodeConfig) (returned error) {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := config.Validate(); err != nil {
		return err
	}
	if err := os.MkdirAll(config.WorkspaceRoot, 0700); err != nil {
		return nodeCause(err)
	}
	stat, err := os.Lstat(config.WorkspaceRoot)
	if err != nil {
		return nodeCause(err)
	}
	if !stat.IsDir() || stat.Mode()&os.ModeSymlink != 0 {
		return service.ErrTorrentBinding
	}
	root, err := os.OpenRoot(config.WorkspaceRoot)
	if err != nil {
		return nodeCause(err)
	}
	defer func() { returned = errors.Join(returned, nodeCause(root.Close())) }()
	return ctx.Err()
}

// PrepareJob 在Submitted围栏之前准备私有目录，保证RPC种子保存不会因父目录缺失而悄悄失败。
func (c *Client) PrepareJob(ctx context.Context, job service.TorrentJob) (returned error) {
	if err := c.validateJob(job); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	workspace, err := os.OpenRoot(c.config.WorkspaceRoot)
	if err != nil {
		return nodeCause(err)
	}
	defer func() { returned = errors.Join(returned, nodeCause(workspace.Close())) }()
	stat, err := workspace.Lstat(job.GID)
	if errors.Is(err, os.ErrNotExist) {
		if err := workspace.Mkdir(job.GID, 0700); err != nil {
			return nodeCause(err)
		}
	} else if err != nil {
		return nodeCause(err)
	} else if !stat.IsDir() || stat.Mode()&os.ModeSymlink != 0 {
		return service.ErrTorrentBinding
	}
	root, err := workspace.OpenRoot(job.GID)
	if err != nil {
		return nodeCause(err)
	}
	return nodeCause(root.Close())
}

func stoppedState(state service.TorrentNodeState) bool {
	return state == service.TorrentNodeComplete || state == service.TorrentNodeError || state == service.TorrentNodeRemoved
}

func validCloneFiles(files []service.TorrentFile) error {
	if len(files) > service.MaxTorrentFiles {
		return model.ErrTooLarge
	}
	var total int64
	seen := map[string]bool{}
	indexes := map[int]bool{}
	for _, file := range files {
		if file.Index < 1 || file.Index > service.MaxTorrentFiles || indexes[file.Index] || !filepath.IsLocal(file.Path) || file.Path == "." || strings.Contains(file.Path, "\\") || path.Clean(file.Path) != file.Path || len(file.Path) > service.MaxTorrentPathBytes || file.SizeBytes < 0 || file.SizeBytes > model.MaxFileContentBytes-total || seen[strings.ToLower(file.Path)] {
			return service.ErrTorrentBinding
		}
		total += file.SizeBytes
		seen[strings.ToLower(file.Path)] = true
		indexes[file.Index] = true
	}
	return nil
}

// ClonePartial 只读取已暂停/终结的旧job，并写入全新GID目录；下载器随后重新校验piece。
// 不复制第三方控制文件，不把旧数据直接当作已验证的最终内容。
func (c *Client) ClonePartial(ctx context.Context, previous, next service.TorrentJob, files []service.TorrentFile) (returned error) {
	if err := c.validateJob(previous); err != nil {
		return err
	}
	if err := c.validateJob(next); err != nil {
		return err
	}
	if previous.GID == next.GID || previous.Phase != service.TorrentJobPayload || next.Phase != service.TorrentJobPayload {
		return service.ErrTorrentBinding
	}
	if err := validCloneFiles(files); err != nil {
		return err
	}
	progress, err := c.Progress(ctx, previous)
	if err != nil && !errors.Is(err, service.ErrTorrentJobMissing) {
		return err
	}
	if err == nil && progress.State != service.TorrentNodePaused && !stoppedState(progress.State) {
		return model.ErrBusy
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	workspace, err := os.OpenRoot(c.config.WorkspaceRoot)
	if err != nil {
		return nodeCause(err)
	}
	defer func() { returned = errors.Join(returned, nodeCause(workspace.Close())) }()
	if err := workspace.Mkdir(next.GID, 0700); err != nil {
		return nodeCause(err)
	}
	destination, err := workspace.OpenRoot(next.GID)
	if err != nil {
		return nodeCause(err)
	}
	defer func() { returned = errors.Join(returned, nodeCause(destination.Close())) }()
	for _, file := range files {
		if err := ctx.Err(); err != nil {
			return err
		}
		err := c.withFile(ctx, previous, file.Path, file.SizeBytes, partialMayBeMissing, func(reader io.Reader, size int64) (returned error) {
			if directory := path.Dir(file.Path); directory != "." {
				if err := destination.MkdirAll(filepath.FromSlash(directory), 0700); err != nil {
					return nodeCause(err)
				}
			}
			output, err := destination.OpenFile(filepath.FromSlash(file.Path), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
			if err != nil {
				return nodeCause(err)
			}
			defer func() { returned = errors.Join(returned, nodeCause(output.Close())) }()
			written, err := io.Copy(output, io.LimitReader(reader, size))
			if err != nil {
				return nodeCause(err)
			}
			if written != size {
				return nodeCause(io.ErrUnexpectedEOF)
			}
			return nil
		})
		if err != nil {
			return err
		}
	}
	return nil
}

// CleanupStopped 不使用下载器的全局purge，也不关闭共享daemon。
// 调用方必须先持久确认停止；Unknown Add不能仅凭暂时未找到GID释放预算。
func (c *Client) CleanupStopped(ctx context.Context, job service.TorrentJob) (returned error) {
	if err := c.validateJob(job); err != nil {
		return err
	}
	progress, err := c.Progress(ctx, job)
	missing := errors.Is(err, service.ErrTorrentJobMissing)
	if err != nil && !missing {
		return err
	}
	if !missing && !stoppedState(progress.State) {
		return model.ErrBusy
	}
	if err := c.removeWorkspace(ctx, job); err != nil {
		return err
	}
	if !missing {
		var result string
		if err := c.call(ctx, "aria2.removeDownloadResult", &result, job.GID); err != nil {
			return err
		}
		if result != "OK" {
			return service.ErrTorrentProtocol
		}
	}
	return nil
}

func (c *Client) DiscardUnsubmitted(ctx context.Context, job service.TorrentJob) error {
	return c.removeWorkspace(ctx, job)
}

func (c *Client) removeWorkspace(ctx context.Context, job service.TorrentJob) (returned error) {
	if err := c.validateJob(job); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	workspace, err := os.OpenRoot(c.config.WorkspaceRoot)
	if err != nil {
		return nodeCause(err)
	}
	defer func() { returned = errors.Join(returned, nodeCause(workspace.Close())) }()
	stat, err := workspace.Lstat(job.GID)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nodeCause(err)
	}
	if err == nil && (!stat.IsDir() || stat.Mode()&os.ModeSymlink != 0) {
		return service.ErrTorrentBinding
	}
	if err := workspace.RemoveAll(job.GID); err != nil {
		return nodeCause(err)
	}
	return nil
}
