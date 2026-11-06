package service

import (
	"context"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// PreferencesRepository 复用外部持有的数据库租约，原子保存整个偏好文档。
type PreferencesRepository interface {
	ReadHistoryPreferences(context.Context, string) (model.HistoryPreferences, error)
	SaveHistoryPreferences(context.Context, string, model.HistoryPreferences) (model.HistoryPreferences, error)
	ReadPreferences(context.Context, string) (model.FilePreferences, error)
	SavePreferences(context.Context, string, model.FilePreferences) (model.FilePreferences, error)
}

type Preferences struct{ store PreferencesRepository }

func NewPreferences(store PreferencesRepository) (*Preferences, error) {
	if store == nil {
		return nil, fmt.Errorf("file preferences repository missing")
	}
	return &Preferences{store: store}, nil
}

func (p *Preferences) Read(ctx context.Context, owner string) (model.FilePreferences, error) {
	if owner == "" {
		return model.FilePreferences{}, model.ErrMissing
	}
	return p.store.ReadPreferences(ctx, owner)
}

func (p *Preferences) Save(ctx context.Context, owner string, value model.FilePreferences) (model.FilePreferences, error) {
	if owner == "" {
		return model.FilePreferences{}, model.ErrMissing
	}
	if err := value.Validate(); err != nil {
		return model.FilePreferences{}, err
	}
	return p.store.SavePreferences(ctx, owner, value)
}

func (p *Preferences) ReadHistory(ctx context.Context, owner string) (model.HistoryPreferences, error) {
	if owner == "" {
		return model.HistoryPreferences{}, model.ErrMissing
	}
	return p.store.ReadHistoryPreferences(ctx, owner)
}
func (p *Preferences) SaveHistory(ctx context.Context, owner string, value model.HistoryPreferences) (model.HistoryPreferences, error) {
	if owner == "" {
		return model.HistoryPreferences{}, model.ErrMissing
	}
	if err := value.Validate(); err != nil {
		return model.HistoryPreferences{}, err
	}
	return p.store.SaveHistoryPreferences(ctx, owner, value)
}
