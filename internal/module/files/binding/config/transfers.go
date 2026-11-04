package configbinding

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/kernel/config"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

const defaultStagingPath = ".data/file-transfers"

type TransferConfig struct {
	StagingPath       string        `mapstructure:"stagingPath"`
	ChunkBytes        int64         `mapstructure:"chunkBytes"`
	StagingBytes      int64         `mapstructure:"stagingBytes"`
	OwnerCount        int           `mapstructure:"ownerCount"`
	GlobalCount       int           `mapstructure:"globalCount"`
	Lifetime          time.Duration `mapstructure:"lifetime"`
	LockTimeout       time.Duration `mapstructure:"lockTimeout"`
	LockRetryInterval time.Duration `mapstructure:"lockRetryInterval"`
	NetworkTimeout    time.Duration `mapstructure:"networkTimeout"`
	CompletionTimeout time.Duration `mapstructure:"completionTimeout"`
}

func defaultTransfers() TransferConfig {
	p := service.DefaultTransferPolicy()
	return TransferConfig{StagingPath: defaultStagingPath, ChunkBytes: p.ChunkBytes, StagingBytes: p.StagingBytes, OwnerCount: p.OwnerCount, GlobalCount: p.GlobalCount, Lifetime: p.Lifetime, LockTimeout: p.LockTimeout, LockRetryInterval: p.LockRetryInterval, NetworkTimeout: p.NetworkTimeout, CompletionTimeout: p.CompletionTimeout}
}

func (c Config) TransferPolicy() service.TransferPolicy {
	p := c.Transfers
	return service.TransferPolicy{MaxFileBytes: c.MaxFileBytes, ChunkBytes: p.ChunkBytes, StagingBytes: p.StagingBytes, OwnerCount: p.OwnerCount, GlobalCount: p.GlobalCount, Lifetime: p.Lifetime, LockTimeout: p.LockTimeout, LockRetryInterval: p.LockRetryInterval, NetworkTimeout: p.NetworkTimeout, CompletionTimeout: p.CompletionTimeout}
}

func (c Config) validateTransfers() error {
	if strings.TrimSpace(c.Transfers.StagingPath) == "" || strings.TrimSpace(c.Transfers.StagingPath) != c.Transfers.StagingPath {
		return fmt.Errorf("invalid transfer staging path")
	}
	return c.TransferPolicy().Validate()
}

func transferDefaults(ctx context.Context) (config.Object, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	p := defaultTransfers()
	fields := config.Object{config.FieldOf("stagingPath", config.String(p.StagingPath))}
	for _, item := range []struct {
		name  string
		value int64
	}{{"chunkBytes", p.ChunkBytes}, {"stagingBytes", p.StagingBytes}, {"ownerCount", int64(p.OwnerCount)}, {"globalCount", int64(p.GlobalCount)}} {
		value, err := config.Number(fmt.Sprint(item.value))
		if err != nil {
			return nil, err
		}
		fields = append(fields, config.FieldOf(item.name, value))
	}
	for _, item := range []struct {
		name  string
		value time.Duration
	}{{"lifetime", p.Lifetime}, {"lockTimeout", p.LockTimeout}, {"lockRetryInterval", p.LockRetryInterval}, {"networkTimeout", p.NetworkTimeout}, {"completionTimeout", p.CompletionTimeout}} {
		fields = append(fields, config.FieldOf(item.name, config.String(item.value.String())))
	}
	return fields, nil
}
