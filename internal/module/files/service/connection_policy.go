package service

import (
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
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
	DefaultWriteLockAge                     = 5 * time.Minute
	DefaultWriteLockMaxAge                  = time.Hour
	DefaultWriteLockOwnerLimit              = model.MaxWriteLocksPerOwner
	DefaultWriteLockGlobalLimit             = 5000
)

// ConnectionPolicy 集中限定协议的持久凭据、元数据和请求资源。
type ConnectionPolicy struct {
	WriteLockAge         time.Duration
	WriteLockMaxAge      time.Duration
	WriteLockOwnerLimit  int
	WriteLockGlobalLimit int
	Limit                int
	DefaultAge           time.Duration
	MaxAge               time.Duration
	TreeEntries          int
	DirectoryEntries     int
	XMLBytes             int64
	ResponseBytes        int64
	PathBytes            int
	PathDepth            int
}

func DefaultConnectionPolicy() ConnectionPolicy {
	return ConnectionPolicy{WriteLockAge: DefaultWriteLockAge, WriteLockMaxAge: DefaultWriteLockMaxAge, WriteLockOwnerLimit: DefaultWriteLockOwnerLimit, WriteLockGlobalLimit: DefaultWriteLockGlobalLimit, Limit: DefaultConnectionLimit, DefaultAge: DefaultConnectionAge, MaxAge: DefaultConnectionMaxAge, TreeEntries: DefaultConnectionTreeEntries, DirectoryEntries: DefaultConnectionDirectoryEntries, XMLBytes: DefaultConnectionXMLBytes, ResponseBytes: DefaultConnectionResponseBytes, PathBytes: DefaultConnectionPathBytes, PathDepth: DefaultConnectionPathDepth}
}
func (p ConnectionPolicy) Validate() error {
	if p.WriteLockAge <= 0 || p.WriteLockMaxAge < p.WriteLockAge || p.WriteLockMaxAge > DefaultWriteLockMaxAge || p.WriteLockOwnerLimit < 1 || p.WriteLockOwnerLimit > DefaultWriteLockOwnerLimit || p.WriteLockGlobalLimit < p.WriteLockOwnerLimit || p.WriteLockGlobalLimit > DefaultWriteLockGlobalLimit {
		return fmt.Errorf("invalid file write lock policy")
	}
	if p.Limit < 1 || p.Limit > DefaultConnectionLimit || p.DefaultAge <= 0 || p.MaxAge < p.DefaultAge || p.MaxAge > DefaultConnectionMaxAge || p.TreeEntries < 1 || p.TreeEntries > DefaultConnectionTreeEntries || p.DirectoryEntries < 1 || p.DirectoryEntries > DefaultConnectionDirectoryEntries || p.DirectoryEntries > p.TreeEntries || p.XMLBytes < 1 || p.XMLBytes > DefaultConnectionXMLBytes || p.ResponseBytes < 1 || p.ResponseBytes > DefaultConnectionResponseBytes || p.PathBytes < 1 || p.PathBytes > DefaultConnectionPathBytes || p.PathDepth < 1 || p.PathDepth > DefaultConnectionPathDepth {
		return fmt.Errorf("invalid file connection policy")
	}
	return nil
}
