// Package configbinding 统一文件传输与配额的默认值、校验及配置归属。
package configbinding

import (
	"context"
	"fmt"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type Config struct {
	MaxFileBytes      int64 `mapstructure:"maxFileBytes"`
	QuotaBytes        int64 `mapstructure:"quotaBytes"`
	ConcurrentUploads int   `mapstructure:"concurrentUploads"`
}

func (c Config) Policy() service.Policy {
	return service.Policy{MaxFileBytes: c.MaxFileBytes, QuotaBytes: c.QuotaBytes, ConcurrentUploads: c.ConcurrentUploads}
}
func Decode(snapshot config.Snapshot) (Config, error) {
	p := service.DefaultPolicy()
	c := Config{p.MaxFileBytes, p.QuotaBytes, p.ConcurrentUploads}
	if err := snapshot.DecodeSection("files", &c); err != nil {
		return Config{}, err
	}
	return c, c.Policy().Validate()
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
	return config.Object{config.FieldOf("maxFileBytes", max), config.FieldOf("quotaBytes", quota), config.FieldOf("concurrentUploads", concurrent)}, config.Continue, nil
}
