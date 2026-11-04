//go:build linux

package archiveprocess

import "golang.org/x/sys/unix"

type processGuard struct{}

func newProcessGuard(_ int64) (*processGuard, error) { return &processGuard{}, nil }
func (*processGuard) Attach(_ int) error             { return nil }
func (*processGuard) Close() error                   { return nil }

// RLIMIT_DATA在读取任何不可信输入前约束heap/mmap分配，设置失败即拒绝工作。
func setWorkerMemory(memory int64) error {
	return unix.Setrlimit(unix.RLIMIT_DATA, &unix.Rlimit{Cur: uint64(memory), Max: uint64(memory)})
}
