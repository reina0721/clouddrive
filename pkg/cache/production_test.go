package cache

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/concurrency"
)

func TestGetOrLoadStoresLoadedValue(t *testing.T) {
	client := mustNewClient[string](t, newFakeRemoteStore(), &Config{DefaultTTL: time.Minute})
	calls := 0
	value, err := GetOrLoad(context.Background(), &concurrency.SingleFlight{}, client, "k", func(context.Context) (string, error) {
		calls++
		return "loaded", nil
	})
	if err != nil || value != "loaded" || calls != 1 {
		t.Fatalf("GetOrLoad() value=%q err=%v calls=%d", value, err, calls)
	}
}

func TestGetOrLoadDoesNotMaskCacheFailures(t *testing.T) {
	backendErr := errors.New("cache backend unavailable")
	tests := []struct {
		name    string
		prepare func(*fakeRemoteStore) context.Context
		want    error
	}{
		{
			name: "backend",
			prepare: func(store *fakeRemoteStore) context.Context {
				store.getErr = backendErr
				return context.Background()
			},
			want: backendErr,
		},
		{
			name: "disabled",
			prepare: func(store *fakeRemoteStore) context.Context {
				store.getErr = ErrDisabled
				return context.Background()
			},
			want: ErrDisabled,
		},
		{
			name: "canceled",
			prepare: func(_ *fakeRemoteStore) context.Context {
				ctx, cancel := context.WithCancel(context.Background())
				cancel()
				return ctx
			},
			want: context.Canceled,
		},
		{
			name: "codec",
			prepare: func(store *fakeRemoteStore) context.Context {
				store.values["k"] = []byte("not-msgpack")
				return context.Background()
			},
			want: ErrInvalidCachedValue,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			store := newFakeRemoteStore()
			ctx := test.prepare(store)
			client := mustNewClient[string](t, store, &Config{DefaultTTL: time.Minute})
			loaderCalls := 0
			_, err := GetOrLoad(ctx, &concurrency.SingleFlight{}, client, "k", func(context.Context) (string, error) {
				loaderCalls++
				return "loaded", nil
			})
			if !errors.Is(err, test.want) || loaderCalls != 0 {
				t.Fatalf("GetOrLoad() error=%v loaderCalls=%d, want %v and 0", err, loaderCalls, test.want)
			}
		})
	}
}

func TestGetManySkipsOnlyMissesAndReturnsPartialResults(t *testing.T) {
	store := newFakeRemoteStore()
	store.values["hit"] = mustEncode(t, "value")
	store.values["broken"] = []byte("not-msgpack")
	client := mustNewClient[string](t, store, nil)

	values, err := GetMany(context.Background(), client, "missing", "hit")
	if err != nil || len(values) != 1 || values["hit"] != "value" {
		t.Fatalf("GetMany(miss) values=%v error=%v", values, err)
	}

	values, err = GetMany(context.Background(), client, "hit", "broken")
	if !errors.Is(err, ErrInvalidCachedValue) || len(values) != 1 || values["hit"] != "value" {
		t.Fatalf("GetMany(codec) values=%v error=%v", values, err)
	}

	store.getErr = ErrDisabled
	values, err = GetMany(context.Background(), client, "hit")
	if !errors.Is(err, ErrDisabled) || len(values) != 0 {
		t.Fatalf("GetMany(disabled) values=%v error=%v", values, err)
	}

	store.getErr = nil
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	values, err = GetMany(ctx, client, "hit")
	if !errors.Is(err, context.Canceled) || len(values) != 0 {
		t.Fatalf("GetMany(canceled) values=%v error=%v", values, err)
	}
}
