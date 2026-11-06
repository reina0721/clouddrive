package configbinding

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/reina0721/clouddrive/internal/kernel/config"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type ConnectionConfig struct {
	WriteLockAge         time.Duration `mapstructure:"writeLockAge"`
	WriteLockMaxAge      time.Duration `mapstructure:"writeLockMaxAge"`
	WriteLockOwnerLimit  int           `mapstructure:"writeLockOwnerLimit"`
	WriteLockGlobalLimit int           `mapstructure:"writeLockGlobalLimit"`
	PublicOrigin         string        `mapstructure:"publicOrigin"`
	Limit                int           `mapstructure:"limit"`
	DefaultAge           time.Duration `mapstructure:"defaultAge"`
	MaxAge               time.Duration `mapstructure:"maxAge"`
	TreeEntries          int           `mapstructure:"treeEntries"`
	DirectoryEntries     int           `mapstructure:"directoryEntries"`
	XMLBytes             int64         `mapstructure:"xmlBytes"`
	ResponseBytes        int64         `mapstructure:"responseBytes"`
	PathBytes            int           `mapstructure:"pathBytes"`
	PathDepth            int           `mapstructure:"pathDepth"`
}

// validateConnectionOrigin 只接受显式HTTP(S) origin，不接受路径、凭据或转发头推断。
func (c Config) validateConnectionOrigin() error {
	value := c.Connections.PublicOrigin
	if value == "" {
		return nil
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Hostname() == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.User != nil || value != parsed.Scheme+"://"+parsed.Host {
		return fmt.Errorf("invalid file connection public origin")
	}
	return nil
}

func defaultConnections() ConnectionConfig {
	p := service.DefaultConnectionPolicy()
	return ConnectionConfig{WriteLockAge: p.WriteLockAge, WriteLockMaxAge: p.WriteLockMaxAge, WriteLockOwnerLimit: p.WriteLockOwnerLimit, WriteLockGlobalLimit: p.WriteLockGlobalLimit, Limit: p.Limit, DefaultAge: p.DefaultAge, MaxAge: p.MaxAge, TreeEntries: p.TreeEntries, DirectoryEntries: p.DirectoryEntries, XMLBytes: p.XMLBytes, ResponseBytes: p.ResponseBytes, PathBytes: p.PathBytes, PathDepth: p.PathDepth}
}
func (c Config) ConnectionPolicy() service.ConnectionPolicy {
	p := c.Connections
	return service.ConnectionPolicy{WriteLockAge: p.WriteLockAge, WriteLockMaxAge: p.WriteLockMaxAge, WriteLockOwnerLimit: p.WriteLockOwnerLimit, WriteLockGlobalLimit: p.WriteLockGlobalLimit, Limit: p.Limit, DefaultAge: p.DefaultAge, MaxAge: p.MaxAge, TreeEntries: p.TreeEntries, DirectoryEntries: p.DirectoryEntries, XMLBytes: p.XMLBytes, ResponseBytes: p.ResponseBytes, PathBytes: p.PathBytes, PathDepth: p.PathDepth}
}
func connectionDefaults(ctx context.Context) (config.Object, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	p := defaultConnections()
	fields := config.Object{config.FieldOf("publicOrigin", config.String("")), config.FieldOf("defaultAge", config.String(p.DefaultAge.String())), config.FieldOf("maxAge", config.String(p.MaxAge.String()))}
	fields = append(fields, config.FieldOf("writeLockAge", config.String(p.WriteLockAge.String())), config.FieldOf("writeLockMaxAge", config.String(p.WriteLockMaxAge.String())))
	for _, budget := range []struct {
		name  string
		value int64
	}{{"writeLockOwnerLimit", int64(p.WriteLockOwnerLimit)}, {"writeLockGlobalLimit", int64(p.WriteLockGlobalLimit)}, {"limit", int64(p.Limit)}, {"treeEntries", int64(p.TreeEntries)}, {"directoryEntries", int64(p.DirectoryEntries)}, {"xmlBytes", p.XMLBytes}, {"responseBytes", p.ResponseBytes}, {"pathBytes", int64(p.PathBytes)}, {"pathDepth", int64(p.PathDepth)}} {
		number, err := config.Number(fmt.Sprint(budget.value))
		if err != nil {
			return nil, err
		}
		fields = append(fields, config.FieldOf(budget.name, number))
	}
	return fields, nil
}
