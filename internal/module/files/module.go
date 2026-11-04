// Package files 显式装配文件模块，资源生命周期由应用组合根拥有。
package files

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/adapter/tus"
	"github.com/reina0721/clouddrive/internal/module/files/adapter/unicodename"
	webdavbinding "github.com/reina0721/clouddrive/internal/module/files/binding/webdav"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/repo"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"github.com/reina0721/clouddrive/pkg/logger"
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
	Database            repo.Access
	Content             service.Content
	TransferContent     service.TransferContent
	TransferPolicy      service.TransferPolicy
	StagingPath         string
	Clock               clock.Clock
	IDs                 idgen.Generator
	Actors              handler.ActorAccess
	Logger              logger.Logger
	Policy              service.Policy
	StorageIdentity     string
	Passwords           service.PasscodeHasher
	SharePolicy         service.SharePolicy
	ConnectionPolicy    service.ConnectionPolicy
	ConnectionOrigin    string
	ConnectionAuthority service.ConnectionAuthorizer
	PublicOrigins       []string
}

func New(deps Dependencies) (*handler.Handler, error) {
	if deps.Actors == nil || deps.Logger == nil {
		return nil, fmt.Errorf("files boundary dependencies missing")
	}
	repository, err := repo.New(deps.Database, deps.StorageIdentity)
	if err != nil {
		return nil, err
	}
	useCases, err := service.New(repository, deps.Content, deps.Clock, deps.IDs, unicodename.Normalizer{}, deps.Policy)
	if err != nil {
		return nil, err
	}
	sharing, err := service.NewSharing(useCases, repository, deps.Passwords, deps.SharePolicy)
	if err != nil {
		return nil, err
	}
	connectionRepository, err := repo.NewConnections(deps.Database, deps.StorageIdentity, deps.ConnectionPolicy.TreeEntries)
	if err != nil {
		return nil, err
	}
	connections, err := service.NewConnections(useCases, connectionRepository, deps.ConnectionAuthority, deps.ConnectionPolicy)
	if err != nil {
		return nil, err
	}
	identity, err := stagingIdentity(deps.StagingPath)
	if err != nil {
		return nil, err
	}
	transfersRepository, err := repo.NewTransfers(deps.Database, deps.StorageIdentity, identity)
	if err != nil {
		return nil, err
	}
	p := deps.TransferPolicy
	staging, err := tus.New(tus.Config{Root: deps.StagingPath, LockTimeout: p.LockTimeout, LockRetryInterval: p.LockRetryInterval, NetworkTimeout: p.NetworkTimeout, CompletionTimeout: p.CompletionTimeout, MaxFileBytes: p.MaxFileBytes}, deps.Logger)
	if err != nil {
		return nil, err
	}
	transfers, err := service.NewTransfers(useCases, transfersRepository, staging, deps.TransferContent, connections, p)
	if err != nil {
		return nil, err
	}
	davFiles, err := service.NewDAVFiles(useCases, connections, transfers)
	if err != nil {
		return nil, err
	}
	boundary := &handler.Handler{Service: useCases, Sharing: sharing, Connections: connections, ConnectionOrigin: deps.ConnectionOrigin, Transfers: transfers, TransferProtocol: staging, Actors: deps.Actors, Logger: deps.Logger, PublicOrigins: append([]string(nil), deps.PublicOrigins...)}
	boundary.WebDAV, err = webdavbinding.New(boundary, davFiles, deps.ConnectionPolicy, deps.Policy.MaxFileBytes)
	if err != nil {
		return nil, err
	}
	return boundary, nil
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
