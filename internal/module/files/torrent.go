package files

import (
	"context"

	"github.com/reina0721/clouddrive/internal/module/files/adapter/aria2"
	"github.com/reina0721/clouddrive/internal/module/files/repo"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/clock"
)

// TorrentPreparation 限定节点候选准入所需的资源与位置，不提供运行时任意查找能力。
type TorrentPreparation struct {
	Database        repo.Access
	StorageIdentity string
	StagingPath     string
	MetadataEntries int
	Clock           clock.Clock
	Nodes           []service.TorrentNodeConfig
}

// PrepareTorrentNodes 在生成代准入时拒绝丢失未清理位置，再准备受控共享目录。
func PrepareTorrentNodes(ctx context.Context, preparation TorrentPreparation) error {
	identity, err := stagingIdentity(preparation.StagingPath)
	if err != nil {
		return err
	}
	transfers, err := repo.NewTransfers(preparation.Database, preparation.StorageIdentity, identity, preparation.MetadataEntries, preparation.Clock)
	if err != nil {
		return err
	}
	downloads, err := repo.NewDownloads(transfers)
	if err != nil {
		return err
	}
	torrents, err := repo.NewTorrents(downloads)
	if err != nil {
		return err
	}
	if err := torrents.ValidateTorrentNodes(ctx, preparation.Nodes); err != nil {
		return err
	}
	for _, node := range preparation.Nodes {
		if err := aria2.PrepareRoot(ctx, node); err != nil {
			return err
		}
	}
	return nil
}
