package service

import (
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	DefaultTransferChunkBytes        int64 = 4 << 20
	DefaultTransferStagingBytes      int64 = 2 << 30
	DefaultTransferOwnerCount              = 20
	DefaultTransferGlobalCount             = 100
	DefaultTransferSweepCount              = 2
	DefaultTransferLifetime                = 24 * time.Hour
	DefaultTransferLockTimeout             = 5 * time.Second
	DefaultTransferLockRetryInterval       = 100 * time.Millisecond
	DefaultTransferNetworkTimeout          = 30 * time.Second
	DefaultTransferCompletionTimeout       = 5 * time.Second
)

// TransferPolicy 约束持久暂存的容量和时间；永久对象配额沿用文件 policy。
type TransferPolicy struct {
	MaxFileBytes      int64
	ChunkBytes        int64
	StagingBytes      int64
	OwnerCount        int
	GlobalCount       int
	Lifetime          time.Duration
	LockTimeout       time.Duration
	LockRetryInterval time.Duration
	NetworkTimeout    time.Duration
	CompletionTimeout time.Duration
}

func DefaultTransferPolicy() TransferPolicy {
	return TransferPolicy{MaxFileBytes: DefaultMaxFileBytes, ChunkBytes: DefaultTransferChunkBytes, StagingBytes: DefaultTransferStagingBytes, OwnerCount: DefaultTransferOwnerCount, GlobalCount: DefaultTransferGlobalCount, Lifetime: DefaultTransferLifetime, LockTimeout: DefaultTransferLockTimeout, LockRetryInterval: DefaultTransferLockRetryInterval, NetworkTimeout: DefaultTransferNetworkTimeout, CompletionTimeout: DefaultTransferCompletionTimeout}
}

func (p TransferPolicy) Validate() error {
	if p.MaxFileBytes < 1 || p.MaxFileBytes > DefaultMaxFileBytes || p.ChunkBytes < 1 || p.ChunkBytes > DefaultTransferChunkBytes || p.StagingBytes < p.MaxFileBytes || p.StagingBytes > DefaultTransferStagingBytes || p.OwnerCount < 1 || p.OwnerCount > DefaultTransferOwnerCount || p.GlobalCount < p.OwnerCount || p.GlobalCount > DefaultTransferGlobalCount {
		return fmt.Errorf("invalid transfer capacity policy")
	}
	if p.Lifetime < time.Minute || p.Lifetime > DefaultTransferLifetime || p.LockTimeout <= 0 || p.LockTimeout > DefaultTransferLockTimeout || p.LockRetryInterval <= 0 || p.LockRetryInterval > p.LockTimeout || p.NetworkTimeout <= 0 || p.NetworkTimeout > DefaultTransferNetworkTimeout || p.CompletionTimeout <= 0 || p.CompletionTimeout > DefaultTransferCompletionTimeout {
		return fmt.Errorf("invalid transfer time policy")
	}
	return nil
}

// TransferSnapshot 是同一存储与 owner 锁内读取的 admission 和发布快照。
type TransferSnapshot struct {
	Entries             []model.Entry
	Transfer            *model.Transfer
	GlobalReservedBytes int64
	OwnerReservedBytes  int64
	GlobalReservedCount int64
	OwnerReservedCount  int64
}
