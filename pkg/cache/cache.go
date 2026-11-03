package cache

import (
	"context"
	"fmt"
	"strings"

	"github.com/vmihailenco/msgpack/v5"
)

type remoteClient[T any] struct {
	remote RemoteStore
	cfg    resolvedConfig
}

// New 创建只以远端 Store 为 authority 的泛型缓存客户端。
func New[T any](remote RemoteStore, cfg *Config) (Client[T], error) {
	if remote == nil {
		return nil, ErrNilRemoteStore
	}

	resolved, err := resolveConfig(cfg)
	if err != nil {
		return nil, err
	}

	return &remoteClient[T]{remote: remote, cfg: resolved}, nil
}

func (c *remoteClient[T]) Get(ctx context.Context, key string) (T, error) {
	var zero T
	if err := validateContext(ctx); err != nil {
		return zero, err
	}

	cacheKey, err := c.cacheKey(key)
	if err != nil {
		return zero, err
	}

	encoded, err := c.remote.Get(ctx, cacheKey)
	if err != nil {
		return zero, fmt.Errorf("get remote cache value %q: %w", key, err)
	}
	return decodeValue[T](encoded)
}

func (c *remoteClient[T]) Set(ctx context.Context, key string, value T, options ...SetOption) error {
	if err := validateContext(ctx); err != nil {
		return err
	}

	cacheKey, err := c.cacheKey(key)
	if err != nil {
		return err
	}

	resolvedOptions, err := resolveSetOptions(c.cfg, options...)
	if err != nil {
		return err
	}

	encoded, err := encodeValue(value)
	if err != nil {
		return err
	}

	if err := c.remote.Set(ctx, cacheKey, encoded, resolvedOptions.ttl, resolvedOptions.tags, resolvedOptions.tagsTTL); err != nil {
		return fmt.Errorf("set remote cache value %q: %w", key, err)
	}
	return nil
}

func (c *remoteClient[T]) Delete(ctx context.Context, key string) error {
	if err := validateContext(ctx); err != nil {
		return err
	}

	cacheKey, err := c.cacheKey(key)
	if err != nil {
		return err
	}

	if err := c.remote.Delete(ctx, cacheKey); err != nil {
		return fmt.Errorf("delete remote cache value %q: %w", key, err)
	}
	return nil
}

func (c *remoteClient[T]) InvalidateTags(ctx context.Context, tags ...string) error {
	if err := validateContext(ctx); err != nil {
		return err
	}

	normalizedTags := normalizeTags(c.cfg, tags)
	if len(normalizedTags) == 0 {
		return nil
	}
	if err := c.remote.InvalidateTags(ctx, normalizedTags); err != nil {
		return fmt.Errorf("invalidate remote cache tags: %w", err)
	}
	return nil
}

func (c *remoteClient[T]) cacheKey(key string) (string, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return "", ErrEmptyKey
	}
	return c.cfg.KeyPrefix + key, nil
}

func encodeValue[T any](value T) ([]byte, error) {
	encoded, err := msgpack.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("%w: marshal value: %v", ErrInvalidCachedValue, err)
	}
	return encoded, nil
}

func decodeValue[T any](encoded []byte) (T, error) {
	var value T
	if err := msgpack.Unmarshal(encoded, &value); err != nil {
		return value, fmt.Errorf("%w: unmarshal value: %v", ErrInvalidCachedValue, err)
	}
	return value, nil
}
