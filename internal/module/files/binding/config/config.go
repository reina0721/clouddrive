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
	Offline           service.DownloadPolicy `mapstructure:"offline"`
	MaxFileBytes      int64                  `mapstructure:"maxFileBytes"`
	QuotaBytes        int64                  `mapstructure:"quotaBytes"`
	ConcurrentUploads int                    `mapstructure:"concurrentUploads"`
	MaxTextBytes      int64                  `mapstructure:"maxTextBytes"`
	MaxArchiveBytes   int64                  `mapstructure:"maxArchiveBytes"`
	MaxBatchEntries   int                    `mapstructure:"maxBatchEntries"`
	MaxMediaBytes     int64                  `mapstructure:"maxMediaBytes"`
	MaxThumbnailBytes int64                  `mapstructure:"maxThumbnailBytes"`
	MaxGalleryEntries int                    `mapstructure:"maxGalleryEntries"`
	Sharing           ShareConfig            `mapstructure:"sharing"`
	Transfers         TransferConfig         `mapstructure:"transfers"`
	Connections       ConnectionConfig       `mapstructure:"connections"`
	Navigation        NavigationConfig       `mapstructure:"navigation"`
	Search            SearchConfig           `mapstructure:"search"`
	Annotations       AnnotationConfig       `mapstructure:"annotations"`
	History           HistoryConfig          `mapstructure:"history"`
}

type ShareConfig struct {
	MaxAge         time.Duration `mapstructure:"maxAge"`
	GrantTTL       time.Duration `mapstructure:"grantTTL"`
	AttemptWindow  time.Duration `mapstructure:"attemptWindow"`
	AttemptLimit   int           `mapstructure:"attemptLimit"`
	KDFConcurrency int           `mapstructure:"kdfConcurrency"`
	DownloadTTL    time.Duration `mapstructure:"downloadTTL"`
	DownloadLimit  int           `mapstructure:"downloadLimit"`
}

func (c Config) SharePolicy() service.SharePolicy {
	p := c.Sharing
	return service.SharePolicy{MaxAge: p.MaxAge, GrantTTL: p.GrantTTL, AttemptWindow: p.AttemptWindow, AttemptLimit: p.AttemptLimit, KDFConcurrency: p.KDFConcurrency, DownloadTTL: p.DownloadTTL, DownloadLimit: p.DownloadLimit}
}

func (c Config) Policy() service.Policy {
	return service.Policy{MaxFileBytes: c.MaxFileBytes, QuotaBytes: c.QuotaBytes, ConcurrentUploads: c.ConcurrentUploads, MaxTextBytes: c.MaxTextBytes, MaxArchiveBytes: c.MaxArchiveBytes, MaxBatchEntries: c.MaxBatchEntries, MaxThumbnailBytes: c.MaxThumbnailBytes, MaxMediaBytes: c.MaxMediaBytes, MaxGalleryEntries: c.MaxGalleryEntries, ShortcutLimit: c.Navigation.ShortcutLimit, SearchTreeEntries: c.Search.TreeEntries, AnnotationMaxBytes: c.Annotations.MaxBytes, AnnotationBatchEntries: c.Annotations.BatchEntries, HistoryEnabled: c.History.Enabled, HistoryPerFile: c.History.PerFile, HistoryPerOwner: c.History.PerOwner}
}
func Decode(snapshot config.Snapshot) (Config, error) {
	p := service.DefaultPolicy()
	c := Config{MaxFileBytes: p.MaxFileBytes, QuotaBytes: p.QuotaBytes, ConcurrentUploads: p.ConcurrentUploads, MaxTextBytes: p.MaxTextBytes, MaxArchiveBytes: p.MaxArchiveBytes, MaxBatchEntries: p.MaxBatchEntries, MaxThumbnailBytes: p.MaxThumbnailBytes, MaxMediaBytes: p.MaxMediaBytes, MaxGalleryEntries: p.MaxGalleryEntries}
	share := service.DefaultSharePolicy()
	c.Sharing = ShareConfig{MaxAge: share.MaxAge, GrantTTL: share.GrantTTL, AttemptWindow: share.AttemptWindow, AttemptLimit: share.AttemptLimit, KDFConcurrency: share.KDFConcurrency, DownloadTTL: share.DownloadTTL, DownloadLimit: share.DownloadLimit}
	c.Offline = service.DefaultDownloadPolicy()
	c.Transfers = defaultTransfers()
	c.Connections = defaultConnections()
	c.Navigation = defaultNavigation()
	c.Search = SearchConfig{TreeEntries: service.DefaultSearchTreeEntries}
	c.Annotations = AnnotationConfig{MaxBytes: p.AnnotationMaxBytes, BatchEntries: p.AnnotationBatchEntries}
	c.History = HistoryConfig{Enabled: p.HistoryEnabled, PerFile: p.HistoryPerFile, PerOwner: p.HistoryPerOwner}
	if err := snapshot.DecodeSection("files", &c); err != nil {
		return Config{}, err
	}
	if err := c.Policy().Validate(); err != nil {
		return Config{}, err
	}
	if err := c.NavigationPolicy().Validate(); err != nil {
		return Config{}, err
	}
	if err := c.SharePolicy().Validate(); err != nil {
		return Config{}, err
	}
	if err := c.ConnectionPolicy().Validate(); err != nil {
		return Config{}, err
	}
	if err := c.validateConnectionOrigin(); err != nil {
		return Config{}, err
	}
	if err := c.Offline.Validate(); err != nil {
		return Config{}, err
	}
	return c, c.validateTransfers()
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
	}{{"maxTextBytes", p.MaxTextBytes}, {"maxArchiveBytes", p.MaxArchiveBytes}, {"maxBatchEntries", int64(p.MaxBatchEntries)}, {"maxMediaBytes", p.MaxMediaBytes}, {"maxThumbnailBytes", p.MaxThumbnailBytes}, {"maxGalleryEntries", int64(p.MaxGalleryEntries)}} {
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
	downloadLimit, err := config.Number(fmt.Sprint(share.DownloadLimit))
	if err != nil {
		return nil, config.Continue, err
	}
	fields = append(fields, config.FieldOf("sharing", config.ObjectValue(config.Object{config.FieldOf("maxAge", config.String(share.MaxAge.String())), config.FieldOf("grantTTL", config.String(share.GrantTTL.String())), config.FieldOf("attemptWindow", config.String(share.AttemptWindow.String())), config.FieldOf("attemptLimit", limit), config.FieldOf("kdfConcurrency", kdf), config.FieldOf("downloadTTL", config.String(share.DownloadTTL.String())), config.FieldOf("downloadLimit", downloadLimit)})))
	transfers, err := transferDefaults(ctx)
	if err != nil {
		return nil, config.Continue, err
	}
	fields = append(fields, config.FieldOf("transfers", config.ObjectValue(transfers)))
	connections, err := connectionDefaults(ctx)
	if err != nil {
		return nil, config.Continue, err
	}
	fields = append(fields, config.FieldOf("connections", config.ObjectValue(connections)))
	navigation, err := navigationDefaults(ctx)
	if err != nil {
		return nil, config.Continue, err
	}
	fields = append(fields, config.FieldOf("navigation", config.ObjectValue(navigation)))
	search, err := searchDefaults(ctx)
	if err != nil {
		return nil, config.Continue, err
	}
	fields = append(fields, config.FieldOf("search", config.ObjectValue(search)))
	annotations, err := annotationDefaults(ctx)
	if err != nil {
		return nil, config.Continue, err
	}
	fields = append(fields, config.FieldOf("annotations", config.ObjectValue(annotations)))
	history, err := historyDefaults(ctx)
	if err != nil {
		return nil, config.Continue, err
	}
	fields = append(fields, config.FieldOf("history", config.ObjectValue(history)))
	offline, err := offlineDefaults(ctx)
	if err != nil {
		return nil, config.Continue, err
	}
	fields = append(fields, config.FieldOf("offline", config.ObjectValue(offline)))
	return fields, config.Continue, nil
}
