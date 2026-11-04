package configbinding

import (
	"context"
	"fmt"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type SearchConfig struct {
	TreeEntries int `mapstructure:"treeEntries"`
}

func searchDefaults(ctx context.Context) (config.Object, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	number, err := config.Number(fmt.Sprint(service.DefaultSearchTreeEntries))
	if err != nil {
		return nil, err
	}
	return config.Object{config.FieldOf("treeEntries", number)}, nil
}
