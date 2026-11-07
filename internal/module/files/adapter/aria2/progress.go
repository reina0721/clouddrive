package aria2

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type nodeFile struct {
	Index     string `json:"index"`
	Path      string `json:"path"`
	Length    string `json:"length"`
	Completed string `json:"completedLength"`
	Selected  string `json:"selected"`
}

type nodeProgress struct {
	GID       string                   `json:"gid"`
	Directory string                   `json:"dir"`
	State     service.TorrentNodeState `json:"status"`
	InfoHash  string                   `json:"infoHash"`
	Total     string                   `json:"totalLength"`
	Completed string                   `json:"completedLength"`
	Rate      string                   `json:"downloadSpeed"`
	Files     []nodeFile               `json:"files"`
}

func unsignedBytes(raw string) (int64, error) {
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value < 0 || strconv.FormatInt(value, 10) != raw {
		return 0, service.ErrTorrentProtocol
	}
	return value, nil
}

func (c *Client) Progress(ctx context.Context, job service.TorrentJob) (service.TorrentNodeProgress, error) {
	if err := c.validateJob(job); err != nil {
		return service.TorrentNodeProgress{}, err
	}
	var actual nodeProgress
	// tellStatus在活动与终结结果上都提供dir；getOption不能作为终结结果的存在性证明。
	fields := []string{"gid", "dir", "status", "infoHash", "totalLength", "completedLength", "downloadSpeed", "files"}
	if err := c.call(ctx, "aria2.tellStatus", &actual, job.GID, fields); err != nil {
		return service.TorrentNodeProgress{}, err
	}
	if actual.GID != job.GID || len(actual.Files) > service.MaxTorrentFiles {
		return service.TorrentNodeProgress{}, service.ErrTorrentProtocol
	}
	if filepath.Clean(actual.Directory) != filepath.Clean(job.Directory) {
		return service.TorrentNodeProgress{}, service.ErrTorrentBinding
	}
	switch actual.State {
	case service.TorrentNodeActive, service.TorrentNodeWaiting, service.TorrentNodePaused, service.TorrentNodeComplete, service.TorrentNodeError, service.TorrentNodeRemoved:
	default:
		return service.TorrentNodeProgress{}, service.ErrTorrentProtocol
	}
	if actual.InfoHash != "" {
		decoded, err := hex.DecodeString(actual.InfoHash)
		if err != nil || len(decoded) != sha1.Size {
			return service.TorrentNodeProgress{}, service.ErrTorrentProtocol
		}
	}
	total, err := unsignedBytes(actual.Total)
	if err != nil || total > model.MaxFileContentBytes {
		return service.TorrentNodeProgress{}, service.ErrTorrentProtocol
	}
	completed, err := unsignedBytes(actual.Completed)
	if err != nil || completed > total {
		return service.TorrentNodeProgress{}, service.ErrTorrentProtocol
	}
	rate, err := unsignedBytes(actual.Rate)
	if err != nil {
		return service.TorrentNodeProgress{}, err
	}
	result := service.TorrentNodeProgress{State: actual.State, InfoHash: strings.ToLower(actual.InfoHash), TotalBytes: total, ReceivedBytes: completed, RateBytesPerSecond: rate, Files: []service.TorrentNodeFile{}}
	// 磁力阶段下载器的虚拟metadata条目不是payload路径或用户可选文件。
	if job.Phase == service.TorrentJobMetadata {
		return result, nil
	}
	seen := map[int]bool{}
	for _, file := range actual.Files {
		index, err := strconv.Atoi(file.Index)
		if err != nil || index < 1 || index > service.MaxTorrentFiles || seen[index] {
			return service.TorrentNodeProgress{}, service.ErrTorrentProtocol
		}
		seen[index] = true
		size, err := unsignedBytes(file.Length)
		if err != nil || size > model.MaxFileContentBytes {
			return service.TorrentNodeProgress{}, service.ErrTorrentProtocol
		}
		received, err := unsignedBytes(file.Completed)
		if err != nil || received > size {
			return service.TorrentNodeProgress{}, service.ErrTorrentProtocol
		}
		if file.Selected != "true" && file.Selected != "false" {
			return service.TorrentNodeProgress{}, service.ErrTorrentProtocol
		}
		relative, err := filepath.Rel(job.Directory, file.Path)
		if err != nil || !filepath.IsLocal(relative) || relative == "." || len(relative) > service.MaxTorrentPathBytes {
			return service.TorrentNodeProgress{}, service.ErrTorrentBinding
		}
		result.Files = append(result.Files, service.TorrentNodeFile{Index: index, Path: filepath.ToSlash(relative), SizeBytes: size, ReceivedBytes: received, Selected: file.Selected == "true"})
	}
	return result, nil
}
