// Package files 显式装配文件模块，资源生命周期由应用组合根拥有。
package files

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module"
	"github.com/reina0721/clouddrive/internal/module/files/adapter/aria2"
	"github.com/reina0721/clouddrive/internal/module/files/adapter/httpdownload"
	"github.com/reina0721/clouddrive/internal/module/files/adapter/metainfo"
	"github.com/reina0721/clouddrive/internal/module/files/adapter/tus"
	"github.com/reina0721/clouddrive/internal/module/files/adapter/unicodename"
	webdavbinding "github.com/reina0721/clouddrive/internal/module/files/binding/webdav"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/repo"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/execution"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"github.com/reina0721/clouddrive/pkg/logger"
	"github.com/reina0721/clouddrive/pkg/schedule"
	"github.com/reina0721/clouddrive/pkg/supervisor"
	"path/filepath"
	"time"
)

// ValidateStorage 将存储身份校验放在候选准入，不混入纯内存构造器。
func ValidateStorage(ctx context.Context, access repo.Access, identity string, currentClock clock.Clock) error {
	repository, err := repo.New(access, identity, currentClock)
	if err != nil {
		return err
	}
	return repository.ValidateStorage(ctx, identity)
}

type Dependencies struct {
	PublicAuthentication     handler.PublicAuthenticator
	ArchiveProcessor         service.ArchiveProcessor
	ArchiveAuthority         service.ArchiveAccountAuthority
	ArchiveDispatcherEnabled bool
	OfflinePolicy            service.DownloadPolicy
	OfflineDispatcherEnabled bool
	TorrentDispatcherEnabled bool
	OfflineAuthority         service.DownloadAccountAuthority
	ShareAuthority           service.ShareAccountAuthority
	Database                 repo.Access
	Content                  service.Content
	BlobProbe                service.BlobObjectProbe
	BlobReclamationPolicy    service.BlobReclamationPolicy
	BlobReclamationAccess    handler.BlobReclamationAuthority
	FilesystemSettings       *service.FilesystemSettings
	FilesystemSettingsAccess handler.FilesystemSettingsAuthority
	TrashScanInterval        time.Duration
	TransferContent          service.TransferContent
	TransferPolicy           service.TransferPolicy
	StagingPath              string
	Clock                    clock.Clock
	IDs                      idgen.Generator
	Actors                   handler.ActorAccess
	Logger                   logger.Logger
	Policy                   service.Policy
	StorageIdentity          string
	Passwords                service.PasscodeHasher
	SharePolicy              service.SharePolicy
	NavigationPolicy         service.NavigationPolicy
	ConnectionPolicy         service.ConnectionPolicy
	ConnectionOrigin         string
	ConnectionAuthority      service.ConnectionAuthorizer
	PublicOrigins            []string
}

// Module 将协议边界和受组合根管理的来源/调度完成品一起交付。
type Module struct {
	Handler      *handler.Handler
	Contribution module.Contribution
}

func New(deps Dependencies) (Module, error) {
	if deps.Actors == nil || deps.Logger == nil || deps.PublicAuthentication == nil || deps.BlobReclamationAccess == nil ||
		deps.FilesystemSettings == nil || deps.FilesystemSettingsAccess == nil {
		return Module{}, fmt.Errorf("files boundary dependencies missing")
	}
	repository, err := repo.New(deps.Database, deps.StorageIdentity, deps.Clock)
	if err != nil {
		return Module{}, err
	}
	useCases, err := service.New(repository, deps.Content, deps.Clock, deps.IDs, unicodename.Normalizer{}, deps.Policy)
	if err != nil {
		return Module{}, err
	}
	archives, err := service.NewArchives(useCases, deps.ArchiveProcessor)
	if err != nil {
		return Module{}, err
	}
	archiveTasks, err := service.NewArchiveTasks(archives, repository, deps.ArchiveAuthority, deps.ArchiveDispatcherEnabled, deps.Logger)
	if err != nil {
		return Module{}, err
	}
	preferences, err := service.NewPreferences(repository)
	if err != nil {
		return Module{}, err
	}
	sharing, err := service.NewSharing(useCases, repository, repository, deps.ShareAuthority, deps.Passwords, deps.SharePolicy)
	if err != nil {
		return Module{}, err
	}
	navigationRepository, err := repo.NewNavigation(deps.Database, deps.StorageIdentity, deps.NavigationPolicy.TreeEntries, deps.Clock)
	if err != nil {
		return Module{}, err
	}
	navigation, err := service.NewNavigation(useCases, navigationRepository, sharing, deps.NavigationPolicy)
	if err != nil {
		return Module{}, err
	}
	connectionRepository, err := repo.NewConnections(deps.Database, deps.StorageIdentity, deps.ConnectionPolicy.TreeEntries, deps.Clock)
	if err != nil {
		return Module{}, err
	}
	connections, err := service.NewConnections(useCases, connectionRepository, deps.ConnectionAuthority, deps.ConnectionPolicy)
	if err != nil {
		return Module{}, err
	}
	identity, err := stagingIdentity(deps.StagingPath)
	if err != nil {
		return Module{}, err
	}
	transfersRepository, err := repo.NewTransfers(deps.Database, deps.StorageIdentity, identity, deps.Policy.SearchTreeEntries, deps.Clock)
	if err != nil {
		return Module{}, err
	}
	p := deps.TransferPolicy
	staging, err := tus.New(tus.Config{Root: deps.StagingPath, LockTimeout: p.LockTimeout, LockRetryInterval: p.LockRetryInterval, NetworkTimeout: p.NetworkTimeout, CompletionTimeout: p.CompletionTimeout, MaxFileBytes: p.MaxFileBytes}, deps.Logger)
	if err != nil {
		return Module{}, err
	}
	transfers, err := service.NewTransfers(useCases, transfersRepository, staging, deps.TransferContent, connections, p)
	if err != nil {
		return Module{}, err
	}
	shareTransfers, err := service.NewShareTransfers(sharing, transfers)
	if err != nil {
		return Module{}, err
	}
	writeLocks, err := service.NewWriteLocks(useCases, connections, repository)
	if err != nil {
		return Module{}, err
	}
	davFiles, err := service.NewDAVFiles(useCases, connections, transfers, writeLocks)
	if err != nil {
		return Module{}, err
	}
	boundary := &handler.Handler{PublicAuthentication: deps.PublicAuthentication, Service: useCases, Sharing: sharing, ShareTransfers: shareTransfers, Navigation: navigation, Preferences: preferences, Connections: connections, ConnectionOrigin: deps.ConnectionOrigin, Transfers: transfers, TransferProtocol: staging, Actors: deps.Actors, Logger: deps.Logger, PublicOrigins: append([]string(nil), deps.PublicOrigins...)}
	boundary.Archives = archives
	boundary.ArchiveTasks = archiveTasks
	boundary.FilesystemSettings = deps.FilesystemSettings
	boundary.FilesystemSettingsAccess = deps.FilesystemSettingsAccess
	boundary.PropertyDefinitions, err = service.NewPropertyDefinitions(repository, unicodename.Normalizer{})
	if err != nil {
		return Module{}, err
	}
	boundary.TrashPurge, err = service.NewTrashPurge(repository, deps.Policy)
	if err != nil {
		return Module{}, err
	}
	boundary.TrashRetention, err = service.NewTrashRetention(repository, deps.Clock, deps.Policy)
	if err != nil {
		return Module{}, err
	}
	boundary.DirectLinks, err = service.NewDirectLinks(useCases, repository, deps.ShareAuthority)
	if err != nil {
		return Module{}, err
	}
	boundary.Inventory, err = service.NewInventory(repository, unicodename.Normalizer{})
	if err != nil {
		return Module{}, err
	}
	boundary.Blobs, err = service.NewBlobCatalog(repository, deps.BlobProbe)
	if err != nil {
		return Module{}, err
	}
	boundary.BlobReclamationAccess = deps.BlobReclamationAccess
	boundary.BlobReclamation, err = service.NewBlobReclamation(repository, deps.Content, deps.Clock, deps.BlobReclamationPolicy)
	if err != nil {
		return Module{}, err
	}
	boundary.BackgroundTasks, err = service.NewBackgroundTasks(repository, archiveTasks)
	if err != nil {
		return Module{}, err
	}
	boundary.WriteLocks = writeLocks
	boundary.WebDAV, err = webdavbinding.New(boundary, davFiles, deps.ConnectionPolicy, deps.Policy.MaxFileBytes)
	if err != nil {
		return Module{}, err
	}
	source, err := httpdownload.New(deps.OfflinePolicy.Source, deps.OfflinePolicy.AttemptTimeout, deps.Logger)
	if err != nil {
		return Module{}, err
	}
	downloadRepository, err := repo.NewDownloads(transfersRepository)
	if err != nil {
		return Module{}, err
	}
	torrentRepository, err := repo.NewTorrents(downloadRepository)
	if err != nil {
		return Module{}, err
	}
	decoder := metainfo.Decoder{}
	nodes := make([]service.TorrentNode, 0, len(deps.OfflinePolicy.TorrentNodes))
	participants := []supervisor.Participant{source}
	for _, configured := range deps.OfflinePolicy.TorrentNodes {
		client, err := aria2.New(configured, decoder, deps.Logger)
		if err != nil {
			return Module{}, err
		}
		nodes = append(nodes, service.TorrentNode{Config: configured, Engine: client})
		participants = append(participants, client)
	}
	torrents, err := service.NewTorrentDownloads(transfers, torrentRepository, decoder, deps.OfflineAuthority, deps.OfflinePolicy, deps.TorrentDispatcherEnabled, nodes, deps.Logger)
	if err != nil {
		return Module{}, err
	}
	downloads, err := service.NewOfflineDownloads(transfers, downloadRepository, source, deps.OfflineAuthority, deps.OfflinePolicy, deps.OfflineDispatcherEnabled, torrents, deps.Logger)
	if err != nil {
		return Module{}, err
	}
	boundary.Downloads = downloads
	boundary.Torrents = torrents
	trigger, err := schedule.FixedDelay(deps.OfflinePolicy.DispatchInterval, deps.OfflinePolicy.DispatchInterval)
	if err != nil {
		return Module{}, err
	}
	concurrency, err := schedule.Concurrency(deps.OfflinePolicy.Concurrency, schedule.CongestionSkip, 0)
	if err != nil {
		return Module{}, err
	}
	binding, err := schedule.Bind(schedule.Spec{ID: service.DownloadDispatchTaskID, Trigger: trigger, Concurrency: concurrency, Coordination: schedule.Local()}, downloads.Dispatch)
	if err != nil {
		return Module{}, err
	}
	torrentTrigger, err := schedule.FixedDelay(deps.OfflinePolicy.DispatchInterval, deps.OfflinePolicy.DispatchInterval)
	if err != nil {
		return Module{}, err
	}
	torrentBinding, err := schedule.Bind(schedule.Spec{ID: service.TorrentDispatchTaskID, Trigger: torrentTrigger, Concurrency: concurrency, Coordination: schedule.Local(), ExecutionPolicy: execution.PersistentTaskPolicyName}, torrents.Dispatch)
	if err != nil {
		return Module{}, err
	}
	archiveTrigger, err := schedule.FixedDelay(service.ArchiveDispatchInterval, service.ArchiveDispatchInterval)
	if err != nil {
		return Module{}, err
	}
	archiveConcurrency, err := schedule.Concurrency(1, schedule.CongestionSkip, 0)
	if err != nil {
		return Module{}, err
	}
	archiveBinding, err := schedule.Bind(schedule.Spec{ID: service.ArchiveDispatchTaskID, Trigger: archiveTrigger, Concurrency: archiveConcurrency, Coordination: schedule.Local(), ExecutionPolicy: execution.PersistentTaskPolicyName}, archiveTasks.Dispatch)
	if err != nil {
		return Module{}, err
	}
	trashTrigger, err := schedule.FixedDelay(deps.TrashScanInterval, deps.TrashScanInterval)
	if err != nil {
		return Module{}, err
	}
	trashBinding, err := schedule.Bind(schedule.Spec{ID: service.TrashExpiryTaskID, Trigger: trashTrigger, Concurrency: archiveConcurrency, Coordination: schedule.Local()}, boundary.TrashRetention.Dispatch)
	if err != nil {
		return Module{}, err
	}
	blobTrigger, err := schedule.FixedDelay(deps.BlobReclamationPolicy.Interval, deps.BlobReclamationPolicy.Interval)
	if err != nil {
		return Module{}, err
	}
	blobBinding, err := schedule.Bind(schedule.Spec{ID: service.BlobReclamationTaskID, Trigger: blobTrigger, Concurrency: archiveConcurrency, Coordination: schedule.Local()}, boundary.BlobReclamation.Dispatch)
	if err != nil {
		return Module{}, err
	}
	return Module{Handler: boundary, Contribution: module.Contribution{ID: "files", Participants: participants, Schedules: []schedule.Binding{binding, torrentBinding, archiveBinding, trashBinding, blobBinding}}}, nil
}

// PrepareFilesystemSettings 在新应用实例构造前只读取一次覆盖，令文件服务与调度使用同一版本。
func PrepareFilesystemSettings(ctx context.Context, access repo.Access, storageIdentity string, currentClock clock.Clock, defaults service.FilesystemRuntime) (*service.FilesystemSettings, service.FilesystemRuntime, error) {
	repository, err := repo.New(access, storageIdentity, currentClock)
	if err != nil {
		return nil, service.FilesystemRuntime{}, err
	}
	stored, err := repository.ReadFilesystemSettings(ctx)
	if err != nil {
		return nil, service.FilesystemRuntime{}, fmt.Errorf("load filesystem settings: %w", err)
	}
	active := defaults.Resolve(stored.Overrides)
	settings, err := service.NewFilesystemSettings(repository, defaults, active)
	return settings, active, err
}

func stagingIdentity(root string) (string, error) {
	if root == "" {
		return "", fmt.Errorf("transfer staging path missing")
	}
	absolute, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256([]byte(absolute))
	return hex.EncodeToString(digest[:]), nil
}

// PrepareTransfers 将暂存目录准入 I/O 与纯内存模块构造分开。
func PrepareTransfers(ctx context.Context, access repo.Access, storageIdentity, root string, currentClock clock.Clock) error {
	identity, err := stagingIdentity(root)
	if err != nil {
		return err
	}
	repository, err := repo.New(access, storageIdentity, currentClock)
	if err != nil {
		return err
	}
	if err := repository.ValidateStagingRoot(ctx, identity); err != nil {
		return err
	}
	return tus.PrepareRoot(ctx, root)
}
