// Package configbinding 统一文件传输与配额的默认值、校验及配置归属。
package configbinding

import (
	"context"
	"fmt"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"time"
)

type Config struct {
	MaxFileBytes      int64       `mapstructure:"maxFileBytes"`
	QuotaBytes        int64       `mapstructure:"quotaBytes"`
	ConcurrentUploads int         `mapstructure:"concurrentUploads"`
	MaxTextBytes      int64       `mapstructure:"maxTextBytes"`
	MaxArchiveBytes   int64       `mapstructure:"maxArchiveBytes"`
	MaxBatchEntries   int         `mapstructure:"maxBatchEntries"`
	MaxThumbnailBytes int64       `mapstructure:"maxThumbnailBytes"`
	MaxGalleryEntries int         `mapstructure:"maxGalleryEntries"`
	Sharing           ShareConfig `mapstructure:"sharing"`
}

type ShareConfig struct {
	MaxAge         time.Duration `mapstructure:"maxAge"`
	GrantTTL       time.Duration `mapstructure:"grantTTL"`
	AttemptWindow  time.Duration `mapstructure:"attemptWindow"`
	AttemptLimit   int           `mapstructure:"attemptLimit"`
	KDFConcurrency int           `mapstructure:"kdfConcurrency"`
}

func (c Config) SharePolicy() service.SharePolicy {
	p := c.Sharing
	return service.SharePolicy{MaxAge: p.MaxAge, GrantTTL: p.GrantTTL, AttemptWindow: p.AttemptWindow, AttemptLimit: p.AttemptLimit, KDFConcurrency: p.KDFConcurrency}
}

func (c Config) Policy() service.Policy {
	return service.Policy{MaxFileBytes: c.MaxFileBytes, QuotaBytes: c.QuotaBytes, ConcurrentUploads: c.ConcurrentUploads, MaxTextBytes: c.MaxTextBytes, MaxArchiveBytes: c.MaxArchiveBytes, MaxBatchEntries: c.MaxBatchEntries, MaxThumbnailBytes: c.MaxThumbnailBytes, MaxGalleryEntries: c.MaxGalleryEntries}
}
func Decode(snapshot config.Snapshot) (Config, error) {
	p := service.DefaultPolicy()
	c := Config{MaxFileBytes: p.MaxFileBytes, QuotaBytes: p.QuotaBytes, ConcurrentUploads: p.ConcurrentUploads, MaxTextBytes: p.MaxTextBytes, MaxArchiveBytes: p.MaxArchiveBytes, MaxBatchEntries: p.MaxBatchEntries, MaxThumbnailBytes: p.MaxThumbnailBytes, MaxGalleryEntries: p.MaxGalleryEntries}
	share := service.DefaultSharePolicy()
	c.Sharing = ShareConfig{MaxAge: share.MaxAge, GrantTTL: share.GrantTTL, AttemptWindow: share.AttemptWindow, AttemptLimit: share.AttemptLimit, KDFConcurrency: share.KDFConcurrency}
	if err := snapshot.DecodeSection("files", &c); err != nil {
		return Config{}, err
	}
	if err := c.Policy().Validate(); err != nil {
		return Config{}, err
	}
	return c, c.SharePolicy().Validate()
}
func Binding() config.Binding {
	return config.Binding{CapabilityID: "module.files", ConfigPath: "files", Contract: defaults{}, Validate: func(snapshot config.Snapshot) error { _, err := Decode(snapshot); return err }}
}

type defaults struct{}

func (defaults) Defaults(ctx context.Context) (config.Object, config.Control, error) {
	if err := ctx.Err(); err != nil {
		return nil, config.Continue, err
	}
	p := service.DefaultPolicy()
	max, err := config.Number(fmt.Sprint(p.MaxFileBytes))
	if err != nil {
		return nil, config.Continue, err
	}
	quota, err := config.Number(fmt.Sprint(p.QuotaBytes))
	if err != nil {
		return nil, config.Continue, err
	}
	concurrent, err := config.Number(fmt.Sprint(p.ConcurrentUploads))
	if err != nil {
		return nil, config.Continue, err
	}
	fields := config.Object{config.FieldOf("maxFileBytes", max), config.FieldOf("quotaBytes", quota), config.FieldOf("concurrentUploads", concurrent)}
	for _, budget := range []struct {
		name  string
		value int64
	}{{"maxTextBytes", p.MaxTextBytes}, {"maxArchiveBytes", p.MaxArchiveBytes}, {"maxBatchEntries", int64(p.MaxBatchEntries)}, {"maxThumbnailBytes", p.MaxThumbnailBytes}, {"maxGalleryEntries", int64(p.MaxGalleryEntries)}} {
		number, err := config.Number(fmt.Sprint(budget.value))
		if err != nil {
			return nil, config.Continue, err
		}
		fields = append(fields, config.FieldOf(budget.name, number))
	}
	share := service.DefaultSharePolicy()
	limit, err := config.Number(fmt.Sprint(share.AttemptLimit))
	if err != nil {
		return nil, config.Continue, err
	}
	kdf, err := config.Number(fmt.Sprint(share.KDFConcurrency))
	if err != nil {
		return nil, config.Continue, err
	}
	fields = append(fields, config.FieldOf("sharing", config.ObjectValue(config.Object{config.FieldOf("maxAge", config.String(share.MaxAge.String())), config.FieldOf("grantTTL", config.String(share.GrantTTL.String())), config.FieldOf("attemptWindow", config.String(share.AttemptWindow.String())), config.FieldOf("attemptLimit", limit), config.FieldOf("kdfConcurrency", kdf)})))
	return fields, config.Continue, nil
}
