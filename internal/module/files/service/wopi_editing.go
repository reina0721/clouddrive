package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"slices"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	// MaxWOPIWriteBytes 限制单次已获准的二进制保存，复用传输并发名额。
	MaxWOPIWriteBytes = 8 << 20
	wopiEditTTL       = 2 * time.Hour
	wopiLockTTL       = 30 * time.Minute
)

// WOPILockOperation 只表示协议允许的锁命令。
type WOPILockOperation string

const (
	WOPILockAcquire WOPILockOperation = "LOCK"
	WOPILockGet     WOPILockOperation = "GET_LOCK"
	WOPILockRefresh WOPILockOperation = "REFRESH_LOCK"
	WOPILockUnlock  WOPILockOperation = "UNLOCK"
)

// WOPILockConflict 带回协议要求的当前锁值，常规错误文本不包含锁内容。
type WOPILockConflict struct{ Current string }

func (e *WOPILockConflict) Error() string { return "WOPI lock mismatch" }
func (e *WOPILockConflict) Unwrap() error { return model.ErrConflict }

func (s *WebFilePreviews) authorizeWOPIWrite(ctx context.Context, owner string) error {
	allowed, err := s.authority.AuthorizeShare(ctx, owner, ShareAccountWrite)
	if err != nil {
		return err
	}
	if !allowed {
		return model.ErrMissing
	}
	return nil
}

func (s *WebFilePreviews) editGrant(ctx context.Context, token, entryID string) (webPreviewGrant, error) {
	grant, err := s.readGrant(ctx, token, FilePreviewWOPI, entryID)
	if err != nil {
		return webPreviewGrant{}, err
	}
	if grant.EditSessionID == "" {
		return webPreviewGrant{}, model.ErrMissing
	}
	return grant, nil
}

func wopiSnapshotTarget(snapshot WriteLockSnapshot, entryID string) (model.Entry, string, *model.WriteLock, error) {
	entry, found := model.Find(snapshot.Entries, entryID)
	if !found || entry.Kind != model.File || !model.Visible(snapshot.Entries, entry) {
		return model.Entry{}, "", nil, model.ErrMissing
	}
	namespace, err := model.NewLockNamespace(snapshot.Entries)
	if err != nil {
		return model.Entry{}, "", nil, err
	}
	rootPath, err := namespace.RootPath(entryID)
	if err != nil {
		return model.Entry{}, "", nil, err
	}
	for _, lock := range snapshot.Locks {
		if root, mapped := namespace.Resolve(lock.RootPath); mapped &&
			(root == entryID || (lock.Depth == model.WriteLockDepthInfinity && namespace.Within(root, entryID))) {
			return entry, rootPath, &lock, nil
		}
	}
	return entry, rootPath, nil, nil
}

func matchingWOPILock(lock *model.WriteLock, grant webPreviewGrant, entry model.Entry, value string) bool {
	return lock != nil && lock.WOPISessionID == grant.EditSessionID && lock.WOPIEntryID == entry.ID &&
		lock.WOPIContentRevision == entry.ContentRevision && lock.WOPIValue == value
}

func currentWOPILockValue(lock *model.WriteLock) string {
	if lock == nil {
		return ""
	}
	return lock.WOPIValue
}

// ChangeWOPILock 获取、刷新、读取、释放或原子替换当前会话的锁。
func (s *WebFilePreviews) ChangeWOPILock(ctx context.Context, token, entryID string, operation WOPILockOperation, value, oldValue string) (string, error) {
	grant, err := s.editGrant(ctx, token, entryID)
	if err != nil {
		return "", err
	}
	var current string
	err = s.wopiWrites.ChangeWOPIWriteLocks(ctx, grant.Owner, grant.PolicyRevision, func(snapshot WriteLockSnapshot) (WriteLockChange, error) {
		now := s.files.clock.Now().UTC()
		if now.Unix() >= grant.ExpiresAt {
			return WriteLockChange{}, ErrWOPIAccessToken
		}
		entry, root, lock, err := wopiSnapshotTarget(snapshot, entryID)
		if err != nil {
			return WriteLockChange{}, err
		}
		if entry.ContentRevision != grant.ContentRevision &&
			(lock == nil || lock.WOPISessionID != grant.EditSessionID || lock.WOPIContentRevision != entry.ContentRevision) {
			return WriteLockChange{}, model.ErrMissing
		}
		current = currentWOPILockValue(lock)
		if operation == WOPILockGet {
			return WriteLockChange{}, nil
		}
		if !model.ValidWOPILockValue(value) || (oldValue != "" && (operation != WOPILockAcquire || !model.ValidWOPILockValue(oldValue))) {
			return WriteLockChange{}, model.ErrInvalid
		}
		expires := minTime(now.Add(wopiLockTTL), time.Unix(grant.ExpiresAt, 0).UTC())
		if lock == nil && operation == WOPILockAcquire && oldValue == "" {
			if len(snapshot.Locks) >= s.lockPolicy.WriteLockOwnerLimit || snapshot.GlobalCount >= int64(s.lockPolicy.WriteLockGlobalLimit) {
				return WriteLockChange{}, model.ErrBusy
			}
			id, err := s.files.ids.New()
			if err != nil {
				return WriteLockChange{}, err
			}
			return WriteLockChange{Upsert: &model.WriteLock{
				ID: id, OwnerID: grant.Owner, RootPath: root, Depth: model.WriteLockDepthZero,
				CreatedAt: now, ExpiresAt: expires, Revision: 1, WOPISessionID: grant.EditSessionID,
				WOPIEntryID: entryID, WOPIValue: value, WOPISettingsRevision: grant.PolicyRevision,
				WOPIContentRevision: entry.ContentRevision,
			}}, nil
		}
		expected := value
		if oldValue != "" {
			expected = oldValue
		}
		if !matchingWOPILock(lock, grant, entry, expected) {
			return WriteLockChange{}, &WOPILockConflict{Current: current}
		}
		if operation == WOPILockUnlock {
			return WriteLockChange{RemoveID: lock.ID, ExpectedRevision: lock.Revision}, nil
		}
		if operation != WOPILockAcquire && operation != WOPILockRefresh {
			return WriteLockChange{}, model.ErrUnsupported
		}
		next := *lock
		next.Revision++
		next.WOPIValue = value
		next.ExpiresAt = expires
		return WriteLockChange{Upsert: &next, ExpectedRevision: lock.Revision}, nil
	})
	return current, err
}

// PutWOPIFile 保存完整二进制文件。提交前再次校验锁和内容版本。
func (s *WebFilePreviews) PutWOPIFile(ctx context.Context, token, entryID, lockValue string, source io.Reader, declaredBytes int64) (model.Entry, error) {
	limit := min(MaxWOPIWriteBytes, s.files.policy.MaxFileBytes)
	if declaredBytes > limit {
		return model.Entry{}, model.ErrTooLarge
	}
	if source == nil || declaredBytes < -1 {
		return model.Entry{}, model.ErrInvalid
	}
	grant, err := s.editGrant(ctx, token, entryID)
	if err != nil {
		return model.Entry{}, err
	}
	detail, err := s.files.Detail(ctx, grant.Owner, entryID)
	if err != nil {
		return model.Entry{}, err
	}
	if err := s.verifyGrantVersion(ctx, grant, detail.Entry); err != nil {
		return model.Entry{}, err
	}
	locks, err := s.wopiWrites.ReadWriteLocks(ctx, grant.Owner)
	if err != nil {
		return model.Entry{}, err
	}
	lockIndex := slices.IndexFunc(locks, func(lock model.WriteLock) bool { return lock.WOPIEntryID == entryID })
	if lockIndex < 0 {
		return model.Entry{}, &WOPILockConflict{}
	}
	active := locks[lockIndex]
	if !matchingWOPILock(&active, grant, detail.Entry, lockValue) {
		return model.Entry{}, &WOPILockConflict{Current: active.WOPIValue}
	}
	if err := s.files.policy.NameAdmission.validate(detail.Entry.Name); err != nil {
		return model.Entry{}, err
	}
	payload, err := io.ReadAll(io.LimitReader(source, limit+1))
	if err != nil {
		if ctx.Err() != nil {
			return model.Entry{}, errors.Join(ctx.Err(), err)
		}
		return model.Entry{}, errors.Join(model.ErrInvalid, err)
	}
	if int64(len(payload)) > limit {
		return model.Entry{}, model.ErrTooLarge
	}
	if declaredBytes >= 0 && int64(len(payload)) != declaredBytes {
		return model.Entry{}, errors.Join(model.ErrInvalid, io.ErrUnexpectedEOF)
	}
	objectID, err := s.files.ids.New()
	if err != nil {
		return model.Entry{}, err
	}
	key := "files/" + objectID
	if err := s.files.content.Put(ctx, key, payload, detail.Entry.MediaType); err != nil {
		return model.Entry{}, s.files.compensate(ctx, grant.Owner, key, err)
	}
	digest := sha256.Sum256(payload)
	var result model.Entry
	if err := s.authorizeWOPIWrite(ctx, grant.Owner); err != nil {
		return model.Entry{}, s.files.compensate(ctx, grant.Owner, key, err)
	}
	err = s.wopiWrites.ChangeWOPIWriteLocks(ctx, grant.Owner, grant.PolicyRevision, func(snapshot WriteLockSnapshot) (WriteLockChange, error) {
		now := s.files.clock.Now().UTC()
		if now.Unix() >= grant.ExpiresAt {
			return WriteLockChange{}, ErrWOPIAccessToken
		}
		entry, _, lock, err := wopiSnapshotTarget(snapshot, entryID)
		if err != nil {
			return WriteLockChange{}, err
		}
		if !matchingWOPILock(lock, grant, entry, lockValue) || lock.ID != active.ID ||
			entry.ContentRevision != detail.Entry.ContentRevision || entry.ObjectKey != detail.Entry.ObjectKey {
			return WriteLockChange{}, &WOPILockConflict{Current: currentWOPILockValue(lock)}
		}
		if entry.ContentRevision >= model.MaxContentRevision {
			return WriteLockChange{}, &WOPILockConflict{Current: lock.WOPIValue}
		}
		if err := s.files.policy.NameAdmission.validate(entry.Name); err != nil {
			return WriteLockChange{}, err
		}
		prepared, err := s.files.prepareReplacement(snapshot.Entries, entry, snapshot.HistoryPreferences)
		if err != nil {
			return WriteLockChange{}, err
		}
		used := s.files.replacementUsed(snapshot.Entries, entry, prepared)
		remaining := s.files.policy.QuotaBytes - used
		if remaining < 0 || snapshot.OwnerReservedBytes > remaining || int64(len(payload)) > remaining-snapshot.OwnerReservedBytes {
			return WriteLockChange{}, model.ErrQuota
		}
		prepared.ObjectKey, prepared.ContentSHA, prepared.SizeBytes = key, hex.EncodeToString(digest[:]), int64(len(payload))
		prepared.ContentRevision++
		prepared.UpdatedAt = now
		prepared.UploadKey = ""
		result = prepared
		next := *lock
		next.Revision++
		next.WOPIContentRevision = result.ContentRevision
		return WriteLockChange{Upsert: &next, ExpectedRevision: lock.Revision, Entries: []model.Entry{result}, Authority: model.FileWriteAuthority{WOPILockID: lock.ID}}, nil
	})
	if err != nil {
		var conflict *WOPILockConflict
		if errors.Is(err, model.ErrWriteLocked) && !errors.As(err, &conflict) {
			err = errors.Join(&WOPILockConflict{}, err)
		}
		return model.Entry{}, s.files.compensate(ctx, grant.Owner, key, err)
	}
	return result, nil
}
