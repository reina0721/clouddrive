package service

import (
	"context"
	"errors"
	"github.com/reina0721/clouddrive/internal/module/files/adapter/unicodename"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"sync"
	"testing"
	"time"
)

type memoryRepository struct {
	mu      sync.Mutex
	entries []model.Entry
	fail    error
}

func (r *memoryRepository) RecordCleanup(context.Context, string, string) error { return nil }

func (r *memoryRepository) Read(ctx context.Context, owner string) ([]model.Entry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	result := []model.Entry{}
	for _, entry := range r.entries {
		if entry.OwnerID == owner {
			result = append(result, entry)
		}
	}
	return result, ctx.Err()
}
func (r *memoryRepository) Change(ctx context.Context, owner string, change func([]model.Entry) (model.Entry, error)) (model.Entry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return model.Entry{}, err
	}
	if r.fail != nil {
		return model.Entry{}, r.fail
	}
	entries := []model.Entry{}
	for _, entry := range r.entries {
		if entry.OwnerID == owner {
			entries = append(entries, entry)
		}
	}
	entry, err := change(entries)
	if err != nil {
		return model.Entry{}, err
	}
	for index, old := range r.entries {
		if old.ID == entry.ID {
			r.entries[index] = entry
			return entry, nil
		}
	}
	r.entries = append(r.entries, entry)
	return entry, nil
}

type memoryContent struct {
	mu        sync.Mutex
	objects   map[string][]byte
	deleteErr error
	corrupt   bool
}

func (c *memoryContent) Put(ctx context.Context, key string, content []byte, _ string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return err
	}
	c.objects[key] = append([]byte{}, content...)
	return nil
}
func (c *memoryContent) Get(ctx context.Context, key string) ([]byte, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.corrupt {
		return []byte("corrupt"), nil
	}
	return append([]byte{}, c.objects[key]...), ctx.Err()
}
func (c *memoryContent) Delete(ctx context.Context, key string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.deleteErr != nil {
		return c.deleteErr
	}
	delete(c.objects, key)
	return ctx.Err()
}
func newTestService(t *testing.T, policy Policy) (*Service, *memoryRepository, *memoryContent) {
	t.Helper()
	repository := &memoryRepository{}
	content := &memoryContent{objects: map[string][]byte{}}
	service, err := New(repository, content, clock.System(), idgen.UUID(), unicodename.Normalizer{}, policy)
	if err != nil {
		t.Fatal(err)
	}
	return service, repository, content
}
func requireEntry(t *testing.T, entry model.Entry, err error) model.Entry {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
	return entry
}

func TestDirectoryOwnershipTrashRestoreAndCycles(t *testing.T) {
	s, _, _ := newTestService(t, DefaultPolicy())
	ctx := t.Context()
	folder, err := s.Folder(ctx, "owner", "", "资料")
	folder = requireEntry(t, folder, err)
	child, err := s.Folder(ctx, "owner", folder.ID, "子目录")
	child = requireEntry(t, child, err)
	file, err := s.Upload(ctx, "owner", child.ID, "notes.txt", "upload-notes-key-001", []byte("你好"))
	file = requireEntry(t, file, err)
	if _, err = s.Detail(ctx, "other", file.ID); !errors.Is(err, model.ErrMissing) {
		t.Fatalf("cross-owner read: %v", err)
	}
	if _, err = s.Update(ctx, "owner", folder.ID, Change{ParentID: &child.ID}); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("cycle: %v", err)
	}
	if _, err = s.Folder(ctx, "owner", "", "资料"); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("duplicate: %v", err)
	}
	if _, err := s.Folder(ctx, "owner", "", "cafe\u0301"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Folder(ctx, "owner", "", "CAFÉ"); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("Unicode canonical name collision: %v", err)
	}
	if _, err = s.Trash(ctx, "owner", folder.ID); err != nil {
		t.Fatal(err)
	}
	if _, _, err = s.Download(ctx, "owner", file.ID); !errors.Is(err, model.ErrMissing) {
		t.Fatalf("trashed ancestor leak: %v", err)
	}
	listing, err := s.List(ctx, "owner", Query{Search: "notes"})
	if err != nil || len(listing.Items) != 0 {
		t.Fatalf("trash search leak: %+v %v", listing, err)
	}
	if _, err = s.Restore(ctx, "owner", folder.ID, nil); err != nil {
		t.Fatal(err)
	}
	_, content, err := s.Download(ctx, "owner", file.ID)
	if err != nil || string(content) != "你好" {
		t.Fatalf("restore content: %q %v", content, err)
	}
	if _, err = s.Update(ctx, "other", file.ID, Change{Name: pointer("stolen")}); !errors.Is(err, model.ErrMissing) {
		t.Fatalf("cross-owner update: %v", err)
	}
}
func pointer(value string) *string { return &value }

func TestListingFiltersAndStableSizeOrder(t *testing.T) {
	s, _, _ := newTestService(t, DefaultPolicy())
	ctx := t.Context()
	small, err := s.Upload(ctx, "owner", "", "z.txt", "list-upload-key-001", []byte("a"))
	small = requireEntry(t, small, err)
	large, err := s.Upload(ctx, "owner", "", "a.txt", "list-upload-key-002", []byte("ab"))
	large = requireEntry(t, large, err)
	result, err := s.List(ctx, "owner", Query{Category: "document", Sort: "size"})
	if err != nil || len(result.Items) != 2 || result.Items[0].ID != small.ID {
		t.Fatalf("ascending size: %+v %v", result.Items, err)
	}
	result, err = s.List(ctx, "owner", Query{Category: "document", Sort: "size", Desc: true})
	if err != nil || result.Items[0].ID != large.ID {
		t.Fatalf("descending size: %+v %v", result.Items, err)
	}
	result, err = s.List(ctx, "owner", Query{Search: "A.TXT"})
	if err != nil || len(result.Items) != 1 || result.Items[0].ID != large.ID {
		t.Fatalf("case insensitive search: %+v %v", result.Items, err)
	}
	result, err = s.List(ctx, "owner", Query{Category: "image"})
	if err != nil || len(result.Items) != 0 {
		t.Fatalf("image filter: %+v %v", result.Items, err)
	}
}

func TestUploadIdempotencyQuotaRaceAndCompensation(t *testing.T) {
	policy := Policy{MaxFileBytes: 4, QuotaBytes: 6, ConcurrentUploads: 2}
	s, repository, content := newTestService(t, policy)
	ctx := t.Context()
	entry, err := s.Upload(ctx, "owner", "", "a.txt", "stable-upload-key-001", []byte("abcd"))
	entry = requireEntry(t, entry, err)
	retried, err := s.Upload(ctx, "owner", "", "a.txt", "stable-upload-key-001", []byte("abcd"))
	if err != nil || retried.ID != entry.ID {
		t.Fatalf("retry: %+v %v", retried, err)
	}
	if _, err = s.Upload(ctx, "owner", "", "a.txt", "stable-upload-key-001", []byte("diff")); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("idempotency mismatch: %v", err)
	}
	if _, err = s.Upload(ctx, "owner", "", "b.txt", "stable-upload-key-002", []byte("abc")); !errors.Is(err, model.ErrQuota) {
		t.Fatalf("quota: %v", err)
	}
	if _, err = s.Upload(ctx, "owner", "", "b.txt", "stable-upload-key-002", []byte("abcde")); !errors.Is(err, model.ErrTooLarge) {
		t.Fatalf("size: %v", err)
	}
	if _, err = s.Trash(ctx, "owner", entry.ID); err != nil {
		t.Fatal(err)
	}
	listing, err := s.List(ctx, "owner", Query{})
	if err != nil || listing.UsedBytes != 4 {
		t.Fatalf("trash quota: %+v %v", listing, err)
	}
	repository.fail = errors.New("database unavailable")
	content.deleteErr = errors.New("cleanup unavailable")
	_, err = s.Upload(ctx, "second-owner", "", "c.txt", "stable-upload-key-003", []byte("a"))
	if !errors.Is(err, repository.fail) || !errors.Is(err, content.deleteErr) {
		t.Fatalf("error chain lost: %v", err)
	}
	// 两个并发写入都通过预检查时，事务内配额校验仍只能放行一个。
	race, _, _ := newTestService(t, policy)
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, name := range []string{"first.txt", "second.txt"} {
		wg.Add(1)
		go func(name string) {
			defer wg.Done()
			_, err := race.Upload(ctx, "owner", "", name, name+"-stable-key-01", []byte("abcd"))
			results <- err
		}(name)
	}
	wg.Wait()
	close(results)
	success := 0
	for err := range results {
		if err == nil {
			success++
		} else if !errors.Is(err, model.ErrQuota) {
			t.Fatal(err)
		}
	}
	if success != 1 {
		t.Fatalf("quota successes=%d", success)
	}
}
func TestCancellationSlotsAndIntegrity(t *testing.T) {
	s, _, content := newTestService(t, DefaultPolicy())
	ctx := t.Context()
	first, err := s.AcquireUpload(ctx)
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.AcquireUpload(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.AcquireUpload(ctx); !errors.Is(err, model.ErrBusy) {
		t.Fatal(err)
	}
	first()
	second()
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err = s.AcquireUpload(canceled); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	entry, err := s.Upload(ctx, "owner", "", "text.txt", "integrity-key-0001", []byte("good"))
	entry = requireEntry(t, entry, err)
	content.corrupt = true
	if _, _, err = s.Download(ctx, "owner", entry.ID); err == nil {
		t.Fatal("corrupt bytes returned successfully")
	}
	deadline, cancel := context.WithDeadline(ctx, time.Now().Add(-time.Second))
	defer cancel()
	if _, err = s.Upload(deadline, "owner", "", "late.txt", "integrity-key-0002", []byte("late")); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("deadline cause: %v", err)
	}
}
