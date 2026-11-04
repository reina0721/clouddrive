package service

import (
	"context"
	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type NavigationSnapshot struct {
	Entries            []model.Entry
	EntriesUnavailable bool
	Pins               []model.Pin
	Revision           int64
}

// NavigationRepository 不拥有连接生命周期；所有mutation在同一storage/owner事务内。
type NavigationRepository interface {
	ReadNavigation(context.Context, string) (NavigationSnapshot, error)
	ChangePins(context.Context, string, int64, func(NavigationSnapshot) ([]model.Pin, error)) (NavigationSnapshot, error)
	CreateShortcut(context.Context, string, func([]model.Entry) (model.Entry, error)) (model.Entry, error)
	PurgeShortcut(context.Context, string, string, int64) error
}

type ShortcutTargetState struct {
	Status ShareStatus `json:"status"`
	Locked bool        `json:"locked"`
}

// ShortcutTargets 仅检查当前实例分享事实，不签发或保存解锁授权。
type ShortcutTargets interface {
	InspectShortcutTarget(context.Context, string, int) (ShortcutTargetState, error)
}
