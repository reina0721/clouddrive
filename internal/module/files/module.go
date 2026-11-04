// Package files 显式装配文件模块，资源生命周期由应用组合根拥有。
package files

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module"
	"github.com/reina0721/clouddrive/internal/module/files/adapter/httpdownload"
	"github.com/reina0721/clouddrive/internal/module/files/adapter/tus"
	"github.com/reina0721/clouddrive/internal/module/files/adapter/unicodename"
	webdavbinding "github.com/reina0721/clouddrive/internal/module/files/binding/webdav"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/repo"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"github.com/reina0721/clouddrive/pkg/logger"
	"github.com/reina0721/clouddrive/pkg/schedule"
	"github.com/reina0721/clouddrive/pkg/supervisor"
	"path/filepath"
)

// ValidateStorage 将存储身份校验放在候选准入，不混入纯内存构造器。
func ValidateStorage(ctx context.Context, access repo.Access, identity string) error {
	repository, err := repo.New(access, identity)
	if err != nil {
		return err
	}
	return repository.ValidateStorage(ctx, identity)
}

type Dependencies struct {
	ArchiveProcessor         service.ArchiveProcessor
	OfflinePolicy            service.DownloadPolicy
	OfflineDispatcherEnabled bool
	OfflineAuthority         service.DownloadAccountAuthority
	ShareAuthority           service.ShareAccountAuthority
	Database                 repo.Access
	Content                  service.Content
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
	if deps.Actors == nil || deps.Logger == nil {
		return Module{}, fmt.Errorf("files boundary dependencies missing")
	}
	repository, err := repo.New(deps.Database, deps.StorageIdentity)
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
	sharing, err := service.NewSharing(useCases, repository, repository, deps.ShareAuthority, deps.Passwords, deps.SharePolicy)
	if err != nil {
		return Module{}, err
	}
	navigationRepository, err := repo.NewNavigation(deps.Database, deps.StorageIdentity, deps.NavigationPolicy.TreeEntries)
	if err != nil {
		return Module{}, err
	}
	navigation, err := service.NewNavigation(useCases, navigationRepository, sharing, deps.NavigationPolicy)
	if err != nil {
		return Module{}, err
	}
	connectionRepository, err := repo.NewConnections(deps.Database, deps.StorageIdentity, deps.ConnectionPolicy.TreeEntries)
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
	davFiles, err := service.NewDAVFiles(useCases, connections, transfers)
	if err != nil {
		return Module{}, err
	}
	boundary := &handler.Handler{Service: useCases, Sharing: sharing, ShareTransfers: shareTransfers, Navigation: navigation, Connections: connections, ConnectionOrigin: deps.ConnectionOrigin, Transfers: transfers, TransferProtocol: staging, Actors: deps.Actors, Logger: deps.Logger, PublicOrigins: append([]string(nil), deps.PublicOrigins...)}
	boundary.Archives = archives
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
	downloads, err := service.NewOfflineDownloads(transfers, downloadRepository, source, deps.OfflineAuthority, deps.OfflinePolicy, deps.OfflineDispatcherEnabled, deps.Logger)
	if err != nil {
		return Module{}, err
	}
	boundary.Downloads = downloads
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
	return Module{Handler: boundary, Contribution: module.Contribution{ID: "files", Participants: []supervisor.Participant{source}, Schedules: []schedule.Binding{binding}}}, nil
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
func PrepareTransfers(ctx context.Context, access repo.Access, storageIdentity, root string) error {
	identity, err := stagingIdentity(root)
	if err != nil {
		return err
	}
	repository, err := repo.New(access, storageIdentity)
	if err != nil {
		return err
	}
	if err := repository.ValidateStagingRoot(ctx, identity); err != nil {
		return err
	}
	return tus.PrepareRoot(ctx, root)
}
