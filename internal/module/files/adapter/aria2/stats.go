package aria2

import (
	"context"

	"github.com/reina0721/clouddrive/internal/module/files/service"
)

// GlobalStats 只投影管理界面所需的数字，拒绝畸形或超出浏览器整数精度的响应。
func (c *Client) GlobalStats(ctx context.Context) (service.WorkerNodeStats, error) {
	var result struct {
		Download string `json:"downloadSpeed"`
		Upload   string `json:"uploadSpeed"`
		Active   string `json:"numActive"`
		Waiting  string `json:"numWaiting"`
		Stopped  string `json:"numStopped"`
	}
	if err := c.call(ctx, "aria2.getGlobalStat", &result); err != nil {
		return service.WorkerNodeStats{}, err
	}
	stats := service.WorkerNodeStats{}
	for _, field := range []struct {
		raw  string
		dest *int64
	}{
		{result.Download, &stats.DownloadBytesPerSecond}, {result.Upload, &stats.UploadBytesPerSecond},
		{result.Active, &stats.Active}, {result.Waiting, &stats.Waiting}, {result.Stopped, &stats.Stopped},
	} {
		const maxSafeInteger = 1<<53 - 1
		value, err := unsignedBytes(field.raw)
		if err != nil {
			return service.WorkerNodeStats{}, err
		}
		if value > maxSafeInteger {
			return service.WorkerNodeStats{}, service.ErrTorrentProtocol
		}
		*field.dest = value
	}
	return stats, nil
}
