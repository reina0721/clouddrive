package configbinding

import (
	"context"
	"fmt"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type NavigationConfig struct {
	ShortcutLimit int `mapstructure:"shortcutLimit"`
	PinLimit      int `mapstructure:"pinLimit"`
	TreeEntries   int `mapstructure:"treeEntries"`
	PageSize      int `mapstructure:"pageSize"`
}

func defaultNavigation() NavigationConfig {
	p := service.DefaultNavigationPolicy()
	return NavigationConfig{ShortcutLimit: p.ShortcutLimit, PinLimit: p.PinLimit, TreeEntries: p.TreeEntries, PageSize: p.PageSize}
}
func (c Config) NavigationPolicy() service.NavigationPolicy {
	p := c.Navigation
	return service.NavigationPolicy{ShortcutLimit: p.ShortcutLimit, PinLimit: p.PinLimit, TreeEntries: p.TreeEntries, PageSize: p.PageSize}
}
func navigationDefaults(ctx context.Context) (config.Object, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	p := defaultNavigation()
	fields := config.Object{}
	for _, budget := range []struct {
		name  string
		value int
	}{{"shortcutLimit", p.ShortcutLimit}, {"pinLimit", p.PinLimit}, {"treeEntries", p.TreeEntries}, {"pageSize", p.PageSize}} {
		number, err := config.Number(fmt.Sprint(budget.value))
		if err != nil {
			return nil, err
		}
		fields = append(fields, config.FieldOf(budget.name, number))
	}
	return fields, nil
}
