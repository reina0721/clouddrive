package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// WriteLocks 只拥有文件编辑占用用例，数据库和内容资源仍由组合根管理。
type WriteLocks struct {
	files       *Service
	connections *Connections
	store       WriteLockRepository
}

func NewWriteLocks(files *Service, connections *Connections, store WriteLockRepository) (*WriteLocks, error) {
	if files == nil || connections == nil || store == nil {
		return nil, model.ErrInvalid
	}
	return &WriteLocks{files: files, connections: connections, store: store}, nil
}

func (s *WriteLocks) Remaining(lock model.WriteLock) time.Duration {
	return lock.ExpiresAt.Sub(s.files.clock.Now().UTC())
}

func (s *WriteLocks) RelativeRoot(ctx context.Context, scope DAVScope, lock model.WriteLock) (string, error) {
	connection, entries, err := s.connections.Check(ctx, scope.ConnectionID, scope.Revision, ConnectionRead)
	if err != nil {
		return "", err
	}
	namespace, err := model.NewLockNamespace(entries)
	if err != nil {
		return "", err
	}
	root, mapped := namespace.Resolve(lock.RootPath)
	if !mapped || !namespace.Within(connection.RootID, root) {
		return "", model.ErrMissing
	}
	base, err := namespace.RootPath(connection.RootID)
	if err != nil {
		return "", err
	}
	relative := strings.TrimPrefix(lock.RootPath, strings.TrimSuffix(base, "/"))
	if relative == "" {
		relative = "/"
	}
	return relative, nil
}

type DAVLockRequest struct {
	Depth    model.WriteLockDepth
	OwnerXML string
	Timeout  time.Duration
}

// DAVLockConflict 保留受当前连接可见的冲突根，不把owner绝对目录输出给协议。
type DAVLockConflict struct{ Descendants []string }

func (e *DAVLockConflict) Error() string { return "file write lock conflict" }
func (e *DAVLockConflict) Unwrap() error { return model.ErrWriteLocked }

func (s *WriteLocks) expires(connection model.Connection, requested time.Duration) (time.Time, error) {
	p := s.connections.policy
	if requested < 0 {
		return time.Time{}, model.ErrInvalid
	}
	if requested == 0 {
		requested = p.WriteLockAge
	}
	requested = min(requested, p.WriteLockMaxAge)
	now := s.files.clock.Now().UTC()
	expires := minTime(now.Add(requested), connection.ExpiresAt)
	if !expires.After(now) {
		return time.Time{}, ErrConnectionUnavailable
	}
	return expires, nil
}

func minTime(left, right time.Time) time.Time {
	if left.Before(right) {
		return left
	}
	return right
}

func (s *WriteLocks) checkConnection(snapshot WriteLockSnapshot, scope DAVScope) (model.Connection, error) {
	if snapshot.Connection == nil || snapshot.Connection.Revision != scope.Revision || s.connections.status(*snapshot.Connection, snapshot.Entries) != ConnectionStatusActive {
		return model.Connection{}, ErrConnectionUnavailable
	}
	if snapshot.Connection.ReadOnly {
		return model.Connection{}, ErrConnectionReadOnly
	}
	return *snapshot.Connection, nil
}

// Acquire 同一事务创建未映射空文件与锁，失败只补偿本次候选内容。
func (s *WriteLocks) Acquire(ctx context.Context, scope DAVScope, relative string, request DAVLockRequest) (result model.WriteLock, created bool, resultErr error) {
	if request.Depth != model.WriteLockDepthZero && request.Depth != model.WriteLockDepthInfinity || len(request.OwnerXML) > model.MaxWriteLockOwnerXMLBytes {
		return result, false, model.ErrInvalid
	}
	parts, err := s.connections.parts(relative)
	if err != nil {
		return result, false, err
	}
	connection, entries, err := s.connections.Check(ctx, scope.ConnectionID, scope.Revision, ConnectionWrite)
	if err != nil {
		return result, false, err
	}
	_, existingErr := s.connections.resolve(entries, connection, parts)
	var candidate *model.Entry
	if errors.Is(existingErr, model.ErrMissing) && len(parts) > 0 {
		parent, err := s.connections.resolve(entries, connection, parts[:len(parts)-1])
		if err != nil {
			return result, false, err
		}
		name := parts[len(parts)-1]
		if err := connectionWriteTarget(connection, entries, parent.ID, name); err != nil {
			return result, false, err
		}
		normalized, err := s.files.newContentName(name)
		if err != nil {
			return result, false, err
		}
		id, err := s.files.ids.New()
		if err != nil {
			return result, false, err
		}
		key := "files/" + id
		if err := s.files.content.Put(ctx, key, []byte{}, "application/octet-stream"); err != nil {
			return result, false, s.files.compensate(ctx, connection.OwnerID, key, err)
		}
		digest := sha256.Sum256(nil)
		now := s.files.clock.Now().UTC()
		value := model.Entry{ID: id, OwnerID: connection.OwnerID, ParentID: parent.ID, Name: name, NormalizedName: normalized, Kind: model.File, ObjectKey: key, ContentSHA: hex.EncodeToString(digest[:]), ContentRevision: 1, MediaType: "application/octet-stream", CreatedAt: now, UpdatedAt: now}
		candidate = &value
		defer func() {
			if resultErr != nil {
				resultErr = s.files.compensate(ctx, connection.OwnerID, key, resultErr)
			}
		}()
	} else if existingErr != nil {
		return result, false, existingErr
	}
	id, err := s.files.ids.New()
	if err != nil {
		return result, false, err
	}
	var recursiveConflict *DAVLockConflict
	err = s.store.ChangeWriteLocks(ctx, connection.OwnerID, connection.ID, func(snapshot WriteLockSnapshot) (WriteLockChange, error) {
		current, err := s.checkConnection(snapshot, scope)
		if err != nil {
			return WriteLockChange{}, err
		}
		target, err := s.connections.resolve(snapshot.Entries, current, parts)
		changes := []model.Entry{}
		if candidate != nil {
			if err == nil {
				return WriteLockChange{}, model.ErrConflict
			}
			if !errors.Is(err, model.ErrMissing) {
				return WriteLockChange{}, err
			}
			parent, err := s.connections.resolve(snapshot.Entries, current, parts[:len(parts)-1])
			if err != nil {
				return WriteLockChange{}, err
			}
			if parent.ID != candidate.ParentID {
				return WriteLockChange{}, model.ErrConflict
			}
			if err := connectionWriteTarget(current, snapshot.Entries, parent.ID, candidate.Name); err != nil {
				return WriteLockChange{}, err
			}
			if err := model.Available(snapshot.Entries, "", parent.ID, candidate.NormalizedName); err != nil {
				return WriteLockChange{}, err
			}
			if len(snapshot.Entries) >= s.connections.policy.TreeEntries {
				return WriteLockChange{}, model.ErrTooLarge
			}
			if model.Used(snapshot.Entries) > s.files.policy.QuotaBytes {
				return WriteLockChange{}, model.ErrQuota
			}
			target = *candidate
			changes = append(changes, target)
		} else if err != nil {
			return WriteLockChange{}, err
		}
		if target.Kind == model.Shortcut {
			return WriteLockChange{}, model.ErrUnsupported
		}
		if target.ID != current.RootID {
			if err := connectionWriteTarget(current, snapshot.Entries, target.ParentID, target.Name); err != nil {
				return WriteLockChange{}, err
			}
		}
		condition, err := canonicalDAVCondition(s.files, snapshot.Entries, current, scope.Condition)
		if err != nil {
			return WriteLockChange{}, err
		}
		authority, matched, err := model.EvaluateDAVCondition(snapshot.Entries, snapshot.Locks, condition, current.ID, current.Revision)
		if err != nil {
			return WriteLockChange{}, err
		}
		if !matched {
			return WriteLockChange{}, ErrContentPrecondition
		}
		merged := append(append([]model.Entry(nil), snapshot.Entries...), changes...)
		namespace, err := model.NewLockNamespace(merged)
		if err != nil {
			return WriteLockChange{}, err
		}
		rootPath, err := namespace.RootPath(target.ID)
		if err != nil {
			return WriteLockChange{}, err
		}
		conflict := &DAVLockConflict{}
		for _, lock := range snapshot.Locks {
			root, mapped := namespace.Resolve(lock.RootPath)
			if !mapped {
				continue
			}
			if root == target.ID || lock.Depth == model.WriteLockDepthInfinity && namespace.Within(root, target.ID) {
				return WriteLockChange{}, model.ErrWriteLocked
			}
			if request.Depth == model.WriteLockDepthInfinity && namespace.Within(target.ID, root) {
				base, err := namespace.RootPath(current.RootID)
				if err != nil {
					return WriteLockChange{}, err
				}
				relativeRoot := strings.TrimPrefix(lock.RootPath, strings.TrimSuffix(base, "/"))
				if relativeRoot == "" {
					relativeRoot = "/"
				}
				conflict.Descendants = append(conflict.Descendants, relativeRoot)
			}
		}
		if len(conflict.Descendants) > 0 {
			recursiveConflict = conflict
			return WriteLockChange{}, model.ErrWriteLocked
		}
		p := s.connections.policy
		if len(snapshot.Locks) >= p.WriteLockOwnerLimit || snapshot.GlobalCount >= int64(p.WriteLockGlobalLimit) {
			return WriteLockChange{}, model.ErrBusy
		}
		expires, err := s.expires(current, request.Timeout)
		if err != nil {
			return WriteLockChange{}, err
		}
		result = model.WriteLock{ID: id, OwnerID: current.OwnerID, ConnectionID: current.ID, ConnectionRevision: current.Revision, RootPath: rootPath, Depth: request.Depth, OwnerXML: request.OwnerXML, CreatedAt: s.files.clock.Now().UTC(), ExpiresAt: expires, Revision: 1}
		created = candidate != nil
		return WriteLockChange{Upsert: &result, Entries: changes, Authority: authority}, nil
	})
	// 数据库安全边界只透传errors.Is，业务层显式恢复自己生成的结构化冲突，保留原错误链。
	if recursiveConflict != nil && errors.Is(err, model.ErrWriteLocked) {
		err = errors.Join(recursiveConflict, err)
	}
	return result, created, err
}

// Refresh 允许在同一锁范围内续期；令牌和连接版本必须同时匹配。
func (s *WriteLocks) Refresh(ctx context.Context, scope DAVScope, relative, token string, timeout time.Duration) (model.WriteLock, error) {
	connection, _, err := s.connections.Check(ctx, scope.ConnectionID, scope.Revision, ConnectionWrite)
	if err != nil {
		return model.WriteLock{}, err
	}
	parts, err := s.connections.parts(relative)
	if err != nil {
		return model.WriteLock{}, err
	}
	var result model.WriteLock
	err = s.store.ChangeWriteLocks(ctx, connection.OwnerID, connection.ID, func(snapshot WriteLockSnapshot) (WriteLockChange, error) {
		current, err := s.checkConnection(snapshot, scope)
		if err != nil {
			return WriteLockChange{}, err
		}
		entry, err := s.connections.resolve(snapshot.Entries, current, parts)
		if err != nil {
			return WriteLockChange{}, err
		}
		condition, err := canonicalDAVCondition(s.files, snapshot.Entries, current, scope.Condition)
		if err != nil {
			return WriteLockChange{}, err
		}
		_, matched, err := model.EvaluateDAVCondition(snapshot.Entries, snapshot.Locks, condition, current.ID, current.Revision)
		if err != nil {
			return WriteLockChange{}, err
		}
		if !matched {
			return WriteLockChange{}, ErrContentPrecondition
		}
		namespace, err := model.NewLockNamespace(snapshot.Entries)
		if err != nil {
			return WriteLockChange{}, err
		}
		for _, lock := range snapshot.Locks {
			root, mapped := namespace.Resolve(lock.RootPath)
			if lock.Token() != token || lock.ConnectionID != current.ID || lock.ConnectionRevision != current.Revision || !mapped || !(root == entry.ID || lock.Depth == model.WriteLockDepthInfinity && namespace.Within(root, entry.ID)) {
				continue
			}
			if lock.Revision >= model.MaxContentRevision {
				return WriteLockChange{}, model.ErrConflict
			}
			expires, err := s.expires(current, timeout)
			if err != nil {
				return WriteLockChange{}, err
			}
			result = lock
			result.ExpiresAt = expires
			result.Revision++
			return WriteLockChange{Upsert: &result, ExpectedRevision: lock.Revision}, nil
		}
		return WriteLockChange{}, ErrContentPrecondition
	})
	return result, err
}

func (s *WriteLocks) Unlock(ctx context.Context, scope DAVScope, relative, token string) error {
	connection, _, err := s.connections.Check(ctx, scope.ConnectionID, scope.Revision, ConnectionWrite)
	if err != nil {
		return err
	}
	parts, err := s.connections.parts(relative)
	if err != nil {
		return err
	}
	return s.store.ChangeWriteLocks(ctx, connection.OwnerID, connection.ID, func(snapshot WriteLockSnapshot) (WriteLockChange, error) {
		current, err := s.checkConnection(snapshot, scope)
		if err != nil {
			return WriteLockChange{}, err
		}
		entry, err := s.connections.resolve(snapshot.Entries, current, parts)
		if err != nil {
			return WriteLockChange{}, err
		}
		namespace, err := model.NewLockNamespace(snapshot.Entries)
		if err != nil {
			return WriteLockChange{}, err
		}
		for _, lock := range snapshot.Locks {
			root, mapped := namespace.Resolve(lock.RootPath)
			if lock.Token() == token && lock.ConnectionID == current.ID && lock.ConnectionRevision == current.Revision && mapped && (root == entry.ID || lock.Depth == model.WriteLockDepthInfinity && namespace.Within(root, entry.ID)) {
				return WriteLockChange{RemoveID: lock.ID, ExpectedRevision: lock.Revision}, nil
			}
		}
		return WriteLockChange{}, model.ErrConflict
	})
}

type WriteLockSummary struct {
	ID           string               `json:"id"`
	Path         string               `json:"path"`
	ConnectionID string               `json:"connectionId"`
	Depth        model.WriteLockDepth `json:"depth"`
	ExpiresAt    time.Time            `json:"expiresAt"`
	Revision     int64                `json:"revision"`
	Protocol     FilePreviewProtocol  `json:"protocol,omitempty" enum:"wopi"`
}

func (s *WriteLocks) List(ctx context.Context, owner string) ([]WriteLockSummary, error) {
	locks, err := s.store.ReadWriteLocks(ctx, owner)
	if err != nil {
		return nil, err
	}
	result := make([]WriteLockSummary, 0, len(locks))
	for _, lock := range locks {
		summary := WriteLockSummary{ID: lock.ID, Path: lock.RootPath, ConnectionID: lock.ConnectionID, Depth: lock.Depth, ExpiresAt: lock.ExpiresAt, Revision: lock.Revision}
		if lock.WOPISessionID != "" {
			summary.Protocol = FilePreviewWOPI
		}
		result = append(result, summary)
	}
	return result, nil
}

func (s *WriteLocks) Release(ctx context.Context, owner, id string, revision int64) error {
	if model.ValidateTransferID(id) != nil || revision < 1 {
		return model.ErrInvalid
	}
	return s.store.ChangeWriteLocks(ctx, owner, "", func(snapshot WriteLockSnapshot) (WriteLockChange, error) {
		for _, lock := range snapshot.Locks {
			if lock.ID == id {
				if lock.Revision != revision {
					return WriteLockChange{}, model.ErrConflict
				}
				return WriteLockChange{RemoveID: id, ExpectedRevision: revision}, nil
			}
		}
		return WriteLockChange{}, model.ErrMissing
	})
}
