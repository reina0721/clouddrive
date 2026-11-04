package local

import (
	"bytes"
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	storageclient "github.com/reina0721/clouddrive/pkg/storage/client"
)

// 长度不符、源读取失败或取消都不能替换已经发布的对象。
func TestStreamFailurePreservesPublishedObject(t *testing.T) {
	client, err := New(Config{BasePath: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	ctx := t.Context()
	if err := client.Put(ctx, "owned/object", []byte("original"), storageclient.PutOptions{}); err != nil {
		t.Fatal(err)
	}
	for _, size := range []int64{2, 20} {
		if err := client.PutReader(ctx, "owned/object", strings.NewReader("changed"), size, storageclient.PutOptions{}); err == nil {
			t.Fatal("length mismatch accepted")
		}
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if err := client.PutReader(canceled, "owned/object", strings.NewReader("changed"), 7, storageclient.PutOptions{}); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	payload, _, err := client.Get(ctx, "owned/object")
	if err != nil || string(payload) != "original" {
		t.Fatalf("published object changed: %q %v", payload, err)
	}
}

// 大对象只读取所需片段，且回调结束后旧 reader 立即失效。
func TestScopedReaderSeeksAndExpires(t *testing.T) {
	client, err := New(Config{BasePath: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	payload := bytes.Repeat([]byte("abcdefgh"), 1024*1024)
	if err := client.PutReader(t.Context(), "large", bytes.NewReader(payload), int64(len(payload)), storageclient.PutOptions{}); err != nil {
		t.Fatal(err)
	}
	var retained io.ReadSeeker
	err = client.WithReader(t.Context(), "large", func(reader io.ReadSeeker, info storageclient.ObjectInfo) error {
		retained = reader
		if info.Size != int64(len(payload)) {
			t.Fatal(info.Size)
		}
		if _, err := reader.Seek(-8, io.SeekEnd); err != nil {
			return err
		}
		last := make([]byte, 8)
		if _, err := io.ReadFull(reader, last); err != nil {
			return err
		}
		if string(last) != "abcdefgh" {
			t.Fatal(string(last))
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := retained.Read(make([]byte, 1)); !errors.Is(err, context.Canceled) {
		t.Fatalf("escaped reader remains usable: %v", err)
	}
	if _, err := retained.Seek(0, io.SeekStart); !errors.Is(err, context.Canceled) {
		t.Fatalf("escaped seek remains usable: %v", err)
	}
}
