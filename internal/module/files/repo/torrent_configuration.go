package repo

import (
	"context"
	"fmt"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"gorm.io/gorm"
)

// ValidateTorrentNodes 不允许未清理的job在换端点或换根后失去原位置所有者。
// 已完成清理的历史绑定不阻碍正常配置演进，名称和Secret轮换也不改变位置身份。
func (r *Torrents) ValidateTorrentNodes(ctx context.Context, nodes []service.TorrentNodeConfig) error {
	identities := map[string]string{}
	for _, node := range nodes {
		identity, err := service.TorrentWorkspaceIdentity(node)
		if err != nil {
			return err
		}
		identities[node.ID] = identity
	}
	return r.downloads.use(ctx, func(db *gorm.DB) error {
		var locations []struct{ NodeID, WorkspaceIdentity string }
		if err := db.Model(&torrentJobRecord{}).Distinct("node_id, workspace_identity").Where("cleaned = ?", false).Limit(model.MaxDownloadGlobalRecords + 1).Find(&locations).Error; err != nil {
			return err
		}
		if len(locations) > model.MaxDownloadGlobalRecords {
			return model.ErrTooLarge
		}
		for _, location := range locations {
			if identities[location.NodeID] != location.WorkspaceIdentity {
				return fmt.Errorf("torrent node location change requires cleanup or migration")
			}
		}
		return nil
	})
}
