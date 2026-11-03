package cache

import (
	"context"
	"errors"
	"testing"
	"time"
)

type profile struct {
	ID   int
	Name string
}

func TestNewRejectsInvalidInput(t *testing.T) {
	if _, err := New[profile](nil, nil); !errors.Is(err, ErrNilRemoteStore) {
		t.Fatalf("New nil remote error = %v, want %v", err, ErrNilRemoteStore)
	}

	remote := newFakeRemoteStore()
	if _, err := New[profile](remote, &Config{DefaultTTL: -time.Second}); !errors.Is(err, ErrInvalidTTL) {
		t.Fatalf("New negative ttl error = %v, want %v", err, ErrInvalidTTL)
	}
}

func TestSetRequiresExplicitTTL(t *testing.T) {
	client := mustNewClient[profile](t, newFakeRemoteStore(), nil)

	err := client.Set(context.Background(), "profile:1", profile{ID: 1})
	if !errors.Is(err, ErrInvalidTTL) {
		t.Fatalf("Set error = %v, want %v", err, ErrInvalidTTL)
	}
}

func TestSetRejectsInvalidInput(t *testing.T) {
	client := mustNewClient[profile](t, newFakeRemoteStore(), &Config{DefaultTTL: time.Minute})

	tests := []struct {
		name string
		ctx  context.Context
		key  string
		want error
	}{
		{name: "nil context", ctx: nil, key: "profile:1", want: ErrNilContext},
		{name: "empty key", ctx: context.Background(), key: " ", want: ErrEmptyKey},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := client.Set(tt.ctx, tt.key, profile{ID: 1})
			if !errors.Is(err, tt.want) {
				t.Fatalf("Set error = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestSetGetStructFromRemoteAuthority(t *testing.T) {
	remote := newFakeRemoteStore()
	client := mustNewClient[profile](t, remote, &Config{DefaultTTL: time.Minute})

	want := profile{ID: 1, Name: "Rin"}
	if err := client.Set(context.Background(), "profile:1", want); err != nil {
		t.Fatalf("Set returned error: %v", err)
	}

	got, err := client.Get(context.Background(), "profile:1")
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if got != want {
		t.Fatalf("Get = %+v, want %+v", got, want)
	}
	if remote.getCount != 1 {
		t.Fatalf("remote get count = %d, want 1", remote.getCount)
	}
}

func TestGetAlwaysReadsCurrentRemoteValue(t *testing.T) {
	remote := newFakeRemoteStore()
	remote.values["profile:2"] = mustEncode(t, profile{ID: 2, Name: "First"})

	client := mustNewClient[profile](t, remote, &Config{DefaultTTL: time.Minute})

	got, err := client.Get(context.Background(), "profile:2")
	if err != nil || got.Name != "First" {
		t.Fatalf("first Get = %+v, %v", got, err)
	}

	remote.values["profile:2"] = mustEncode(t, profile{ID: 2, Name: "Second"})
	got, err = client.Get(context.Background(), "profile:2")
	if err != nil || got.Name != "Second" {
		t.Fatalf("second Get = %+v, %v", got, err)
	}
	if remote.getCount != 2 {
		t.Fatalf("remote get count = %d, want 2", remote.getCount)
	}
}

func TestGetReturnsNotFound(t *testing.T) {
	client := mustNewClient[profile](t, newFakeRemoteStore(), &Config{DefaultTTL: time.Minute})

	_, err := client.Get(context.Background(), "missing")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("Get error = %v, want %v", err, ErrNotFound)
	}
}

func TestSetAndGetWrapInvalidCachedValue(t *testing.T) {
	client := mustNewClient[chan int](t, newFakeRemoteStore(), &Config{DefaultTTL: time.Minute})
	err := client.Set(context.Background(), "chan", make(chan int))
	if !errors.Is(err, ErrInvalidCachedValue) {
		t.Fatalf("Set marshal error = %v, want %v", err, ErrInvalidCachedValue)
	}

	remote := newFakeRemoteStore()
	remote.values["broken"] = []byte("not-msgpack")
	brokenClient := mustNewClient[profile](t, remote, &Config{DefaultTTL: time.Minute})
	_, err = brokenClient.Get(context.Background(), "broken")
	if !errors.Is(err, ErrInvalidCachedValue) {
		t.Fatalf("Get decode error = %v, want %v", err, ErrInvalidCachedValue)
	}
}

func TestDeleteFailureLeavesRemoteAuthorityUnchanged(t *testing.T) {
	wantErr := errors.New("redis delete failed")
	remote := newFakeRemoteStore()
	client := mustNewClient[profile](t, remote, &Config{DefaultTTL: time.Minute})

	if err := client.Set(context.Background(), "profile:1", profile{ID: 1}); err != nil {
		t.Fatalf("Set returned error: %v", err)
	}

	remote.deleteErr = wantErr
	err := client.Delete(context.Background(), "profile:1")
	if !errors.Is(err, wantErr) {
		t.Fatalf("Delete error = %v, want %v", err, wantErr)
	}

	value, err := client.Get(context.Background(), "profile:1")
	if err != nil || value.ID != 1 {
		t.Fatalf("Get after failed delete = %+v, %v", value, err)
	}
}

func TestInvalidateTagsDeletesRemoteKeys(t *testing.T) {
	remote := newFakeRemoteStore()
	bytes := mustEncode(t, profile{ID: 3, Name: "Tagged"})
	remote.values["profile:3"] = bytes
	remote.tags["user"] = map[string]struct{}{"profile:3": {}}

	client := mustNewClient[profile](t, remote, &Config{DefaultTTL: time.Minute})
	if _, err := client.Get(context.Background(), "profile:3"); err != nil {
		t.Fatalf("Get returned error: %v", err)
	}

	if err := client.InvalidateTags(context.Background(), "user"); err != nil {
		t.Fatalf("InvalidateTags returned error: %v", err)
	}

	_, err := client.Get(context.Background(), "profile:3")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("Get after invalidate = %v, want %v", err, ErrNotFound)
	}
}

func TestRemoteWriteAndTagErrorsArePreserved(t *testing.T) {
	setErr := errors.New("redis set failed")
	tagErr := errors.New("redis tag invalidation failed")
	remote := newFakeRemoteStore()
	client := mustNewClient[profile](t, remote, &Config{DefaultTTL: time.Minute})

	remote.setErr = setErr
	if err := client.Set(context.Background(), "profile:5", profile{ID: 5}); !errors.Is(err, setErr) {
		t.Fatalf("Set error = %v, want %v", err, setErr)
	}

	remote.tagErr = tagErr
	if err := client.InvalidateTags(context.Background(), "user"); !errors.Is(err, tagErr) {
		t.Fatalf("InvalidateTags error = %v, want %v", err, tagErr)
	}
}

func TestKeyPrefixScopesKeysAndTags(t *testing.T) {
	remote := newFakeRemoteStore()
	client := mustNewClient[profile](t, remote, &Config{
		DefaultTTL: time.Minute,
		KeyPrefix:  "app:",
	})

	if err := client.Set(context.Background(), "profile:4", profile{ID: 4}, WithTags("user")); err != nil {
		t.Fatalf("Set returned error: %v", err)
	}

	if _, exists := remote.values["app:profile:4"]; !exists {
		t.Fatal("remote value was not written with key prefix")
	}
	if _, exists := remote.tags["app:user"]["app:profile:4"]; !exists {
		t.Fatal("remote tag was not written with key prefix")
	}
}

func mustNewClient[T any](t *testing.T, remote RemoteStore, cfg *Config) Client[T] {
	t.Helper()

	client, err := New[T](remote, cfg)
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}
	return client
}

func mustEncode[T any](t *testing.T, value T) []byte {
	t.Helper()

	bytes, err := encodeValue(value)
	if err != nil {
		t.Fatalf("encodeValue returned error: %v", err)
	}
	return bytes
}

type fakeRemoteStore struct {
	values    map[string][]byte
	tags      map[string]map[string]struct{}
	getCount  int
	getErr    error
	setErr    error
	deleteErr error
	tagErr    error
}

func newFakeRemoteStore() *fakeRemoteStore {
	return &fakeRemoteStore{
		values: make(map[string][]byte),
		tags:   make(map[string]map[string]struct{}),
	}
}

func (s *fakeRemoteStore) Get(ctx context.Context, key string) ([]byte, error) {
	s.getCount++
	if err := contextError(ctx); err != nil {
		return nil, err
	}
	if s.getErr != nil {
		return nil, s.getErr
	}
	value, exists := s.values[key]
	if !exists {
		return nil, ErrNotFound
	}
	return append([]byte(nil), value...), nil
}

func (s *fakeRemoteStore) Set(ctx context.Context, key string, value []byte, ttl time.Duration, tags []string, tagsTTL time.Duration) error {
	if err := contextError(ctx); err != nil {
		return err
	}
	if s.setErr != nil {
		return s.setErr
	}

	s.values[key] = append([]byte(nil), value...)
	for _, tag := range tags {
		keys, exists := s.tags[tag]
		if !exists {
			keys = make(map[string]struct{})
			s.tags[tag] = keys
		}
		keys[key] = struct{}{}
	}
	if tagsTTL < 0 {
		return ErrInvalidTTL
	}
	return nil
}

func (s *fakeRemoteStore) Delete(ctx context.Context, key string) error {
	if err := contextError(ctx); err != nil {
		return err
	}
	if s.deleteErr != nil {
		return s.deleteErr
	}
	delete(s.values, key)
	for tag, keys := range s.tags {
		delete(keys, key)
		if len(keys) == 0 {
			delete(s.tags, tag)
		}
	}
	return nil
}

func (s *fakeRemoteStore) InvalidateTags(ctx context.Context, tags []string) error {
	if err := contextError(ctx); err != nil {
		return err
	}
	for _, tag := range tags {
		for key := range s.tags[tag] {
			delete(s.values, key)
		}
		delete(s.tags, tag)
	}
	return s.tagErr
}

var _ RemoteStore = (*fakeRemoteStore)(nil)

func TestFakeRemoteStoreInvalidatesTaggedValues(t *testing.T) {
	store := newFakeRemoteStore()
	store.values["a"] = []byte("a")
	store.values["b"] = []byte("b")
	store.tags["tag"] = map[string]struct{}{"b": {}, "a": {}}

	if err := store.InvalidateTags(context.Background(), []string{"tag"}); err != nil {
		t.Fatalf("InvalidateTags returned error: %v", err)
	}
	if len(store.values) != 0 || len(store.tags) != 0 {
		t.Fatalf("values=%v tags=%v, want empty", store.values, store.tags)
	}
}

func contextError(ctx context.Context) error {
	if ctx == nil {
		return ErrNilContext
	}
	return ctx.Err()
}
