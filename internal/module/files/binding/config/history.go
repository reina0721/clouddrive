package configbinding

import (
	"context"
	"fmt"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type HistoryConfig struct {
	Enabled  bool `mapstructure:"enabled"`
	PerFile  int  `mapstructure:"perFile"`
	PerOwner int  `mapstructure:"perOwner"`
}

func historyDefaults(ctx context.Context) (config.Object, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	policy := service.DefaultPolicy()
	perFile, err := config.Number(fmt.Sprint(policy.HistoryPerFile))
	if err != nil {
		return nil, err
	}
	perOwner, err := config.Number(fmt.Sprint(policy.HistoryPerOwner))
	if err != nil {
		return nil, err
	}
	return config.Object{config.FieldOf("enabled", config.Bool(policy.HistoryEnabled)), config.FieldOf("perFile", perFile), config.FieldOf("perOwner", perOwner)}, nil
}
