//go:build !windows && !linux

package archiveprocess

import "github.com/reina0721/clouddrive/internal/module/files/model"

type processGuard struct{}

func newProcessGuard(_ int64) (*processGuard, error) { return nil, model.ErrUnsupported }
func (*processGuard) Attach(_ int) error             { return model.ErrUnsupported }
func (*processGuard) Close() error                   { return nil }
func setWorkerMemory(_ int64) error                  { return model.ErrUnsupported }
