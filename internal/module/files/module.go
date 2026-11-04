// Package files 显式装配文件模块，资源生命周期由应用组合根拥有。
package files

import (
	"context"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/adapter/unicodename"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/repo"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"github.com/reina0721/clouddrive/pkg/logger"
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
	Database        repo.Access
	Content         service.Content
	Clock           clock.Clock
	IDs             idgen.Generator
	Actors          handler.ActorAccess
	Logger          logger.Logger
	Policy          service.Policy
	StorageIdentity string
	Passwords       service.PasscodeHasher
	SharePolicy     service.SharePolicy
	PublicOrigins   []string
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
	return &handler.Handler{Service: useCases, Sharing: sharing, Actors: deps.Actors, Logger: deps.Logger, PublicOrigins: append([]string(nil), deps.PublicOrigins...)}, nil
}
