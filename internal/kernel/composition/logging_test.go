package composition

import (
	"testing"

	"github.com/reina0721/clouddrive/internal/kernel"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	kernellogging "github.com/reina0721/clouddrive/internal/kernel/logging"
	pkglogger "github.com/reina0721/clouddrive/pkg/logger"
)

func newTestRuntime(t *testing.T, source config.Source) *kernel.Kernel {
	t.Helper()
	manager, err := kernellogging.New(pkglogger.Noop())
	if err != nil {
		t.Fatalf("logging.New() error = %v", err)
	}
	runtime, err := kernel.New(config.New(source), kernel.Options{Logging: manager})
	if err != nil {
		t.Fatalf("kernel.New() error = %v", err)
	}
	return runtime
}
