package webdav

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"testing"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

func TestContentLeaseRetainsUnexpectedEOFWithoutOwningReader(t *testing.T) {
	lease := &contentLease{source: bytes.NewReader([]byte("short")), item: service.DAVItem{Entry: model.Entry{SizeBytes: 12}}}
	if _, err := io.Copy(io.Discard, lease); err != nil {
		t.Fatal(err)
	}
	if !errors.Is(lease.failure, io.ErrUnexpectedEOF) {
		t.Fatal("短读未保留")
	}
	if err := lease.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := lease.Seek(0, io.SeekStart); err != nil {
		t.Fatal("借用关闭破坏外部所有权", err)
	}
}
func TestCleanupFailureTakesPriorityOverClientErrors(t *testing.T) {
	failure := errors.Join(service.ErrCleanup, io.ErrUnexpectedEOF, model.ErrTooLarge)
	if ErrorStatus(failure) != http.StatusInternalServerError || Status(failure) != http.StatusInternalServerError {
		t.Fatal("清理失败被客户端状态掩盖")
	}
}
