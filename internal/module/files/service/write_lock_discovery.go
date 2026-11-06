package service

import (
	"context"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"strings"
)

type DAVDiscoveredLock struct {
	Lock         model.WriteLock
	RelativeRoot string
}

type DAVLockDiscovery struct {
	Locks        []DAVDiscoveredLock
	HiddenRoot   bool
	SupportsLock bool
}

// Discover 一次读取当前账号有界锁，根不在连接可见范围时明确拒绝该属性。
func (s *WriteLocks) Discover(ctx context.Context, scope DAVScope, paths []string) ([]DAVLockDiscovery, error) {
	connection, entries, err := s.connections.Check(ctx, scope.ConnectionID, scope.Revision, ConnectionRead)
	if err != nil {
		return nil, err
	}
	if len(paths) > s.connections.policy.DirectoryEntries+1 {
		return nil, model.ErrTooLarge
	}
	locks, err := s.store.ReadWriteLocks(ctx, connection.OwnerID)
	if err != nil {
		return nil, err
	}
	namespace, err := model.NewLockNamespace(entries)
	if err != nil {
		return nil, err
	}
	base, err := namespace.RootPath(connection.RootID)
	if err != nil {
		return nil, err
	}
	result := make([]DAVLockDiscovery, len(paths))
	for index, path := range paths {
		parts, err := s.connections.parts(path)
		if err != nil {
			return nil, err
		}
		entry, err := s.connections.resolve(entries, connection, parts)
		if err != nil {
			return nil, err
		}
		result[index].Locks = []DAVDiscoveredLock{}
		result[index].SupportsLock = entry.Kind == model.File || entry.Kind == model.Folder
		for _, lock := range locks {
			root, mapped := namespace.Resolve(lock.RootPath)
			if !mapped || !(root == entry.ID || lock.Depth == model.WriteLockDepthInfinity && namespace.Within(root, entry.ID)) {
				continue
			}
			if !namespace.Within(connection.RootID, root) {
				result[index].HiddenRoot = true
				continue
			}
			relativeRoot := strings.TrimPrefix(lock.RootPath, strings.TrimSuffix(base, "/"))
			if relativeRoot == "" {
				relativeRoot = "/"
			}
			result[index].Locks = append(result[index].Locks, DAVDiscoveredLock{Lock: lock, RelativeRoot: relativeRoot})
		}
	}
	return result, nil
}

func (s *DAVFiles) CheckIf(ctx context.Context, scope DAVScope) error {
	if len(scope.Condition.Lists) == 0 {
		return nil
	}
	connection, entries, err := s.snapshot(ctx, scope, ConnectionRead)
	if err != nil {
		return err
	}
	locks, err := s.locks.store.ReadWriteLocks(ctx, connection.OwnerID)
	if err != nil {
		return err
	}
	condition, err := canonicalDAVCondition(s.files, entries, connection, scope.Condition)
	if err != nil {
		return err
	}
	_, matched, err := model.EvaluateDAVCondition(entries, locks, condition, connection.ID, connection.Revision)
	if err != nil {
		return err
	}
	if !matched {
		return ErrContentPrecondition
	}
	return nil
}
