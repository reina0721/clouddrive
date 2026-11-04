package service

import (
	"fmt"
	"time"
)

const (
	DefaultConnectionLimit                  = 20
	DefaultConnectionAge                    = 30 * 24 * time.Hour
	DefaultConnectionMaxAge                 = 365 * 24 * time.Hour
	DefaultConnectionTreeEntries            = 10_000
	DefaultConnectionDirectoryEntries       = 500
	DefaultConnectionXMLBytes         int64 = 64 << 10
	DefaultConnectionResponseBytes    int64 = 1 << 20
	DefaultConnectionPathBytes              = 4096
	DefaultConnectionPathDepth              = 64
)

// ConnectionPolicy 集中限定协议的持久凭据、元数据和请求资源。
type ConnectionPolicy struct {
	Limit            int
	DefaultAge       time.Duration
	MaxAge           time.Duration
	TreeEntries      int
	DirectoryEntries int
	XMLBytes         int64
	ResponseBytes    int64
	PathBytes        int
	PathDepth        int
}

func DefaultConnectionPolicy() ConnectionPolicy {
	return ConnectionPolicy{Limit: DefaultConnectionLimit, DefaultAge: DefaultConnectionAge, MaxAge: DefaultConnectionMaxAge, TreeEntries: DefaultConnectionTreeEntries, DirectoryEntries: DefaultConnectionDirectoryEntries, XMLBytes: DefaultConnectionXMLBytes, ResponseBytes: DefaultConnectionResponseBytes, PathBytes: DefaultConnectionPathBytes, PathDepth: DefaultConnectionPathDepth}
}
func (p ConnectionPolicy) Validate() error {
	if p.Limit < 1 || p.Limit > DefaultConnectionLimit || p.DefaultAge <= 0 || p.MaxAge < p.DefaultAge || p.MaxAge > DefaultConnectionMaxAge || p.TreeEntries < 1 || p.TreeEntries > DefaultConnectionTreeEntries || p.DirectoryEntries < 1 || p.DirectoryEntries > DefaultConnectionDirectoryEntries || p.DirectoryEntries > p.TreeEntries || p.XMLBytes < 1 || p.XMLBytes > DefaultConnectionXMLBytes || p.ResponseBytes < 1 || p.ResponseBytes > DefaultConnectionResponseBytes || p.PathBytes < 1 || p.PathBytes > DefaultConnectionPathBytes || p.PathDepth < 1 || p.PathDepth > DefaultConnectionPathDepth {
		return fmt.Errorf("invalid file connection policy")
	}
	return nil
}
