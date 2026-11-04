package kernel

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/kernel/app"
	"github.com/reina0721/clouddrive/internal/kernel/config"
)

func TestWatchCancelAfterReadyDoesNotReportUnexpectedStop(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	writeVersionFile(t, path, "v1")
	assembly := newTestAssembly(t, config.FileSource(path), Options{Debounce: time.Millisecond, ReloadTimeout: time.Second})
	assembly.add(t, "service", app.KernelInstanceSwap, &eventLog{}, nil, nil)
	assembly.install(t)
	if err := assembly.coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		if err := assembly.coordinator.Stop(ctx); err != nil {
			t.Error(err)
		}
	})
	// 每次都等待真实监听ready再取消，使ctx与底层退出同时就绪的分支有机会被选择。
	for range 100 {
		ctx, cancel := context.WithCancel(t.Context())
		ready, done := make(chan struct{}), make(chan error, 1)
		reloadErrors := make(chan error, 1)
		go func() {
			done <- assembly.coordinator.watch(ctx, func(err error) {
				select {
				case reloadErrors <- err:
				default:
				}
			}, ready)
		}()
		select {
		case <-ready:
		case <-time.After(time.Second):
			cancel()
			t.Fatal("监听未就绪")
		}
		cancel()
		select {
		case err := <-done:
			if err != nil {
				t.Fatal("正常取消被误报", err)
			}
		case <-time.After(time.Second):
			t.Fatal("监听未退出")
		}
		select {
		case err := <-reloadErrors:
			t.Fatal("无修改却触发重载错误", err)
		default:
		}
	}
}
