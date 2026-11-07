package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

var ErrContentPrecondition = errors.New("file content precondition failed")
var ErrConnectionSystemFile = errors.New("file connection blocks system files")

type ContentMatchKind string

const (
	ContentMatchAny   ContentMatchKind = "any"
	ContentMatchExact ContentMatchKind = "exact"
)

type ContentMatch struct {
	Kind ContentMatchKind
	Tag  string
}
type ContentCondition struct {
	DAV      model.DAVCondition
	Match    *ContentMatch
	NotMatch *ContentMatch
}

func checkContentCondition(entry *model.Entry, condition ContentCondition) error {
	matches := func(match *ContentMatch) (bool, error) {
		switch match.Kind {
		case ContentMatchAny:
			return entry != nil, nil
		case ContentMatchExact:
			return entry != nil && entry.ContentSHA == match.Tag, nil
		default:
			return false, model.ErrInvalid
		}
	}
	if condition.Match != nil {
		matched, err := matches(condition.Match)
		if err != nil {
			return err
		}
		if !matched {
			return ErrContentPrecondition
		}
	}
	if condition.NotMatch != nil {
		matched, err := matches(condition.NotMatch)
		if err != nil {
			return err
		}
		if matched {
			return ErrContentPrecondition
		}
	}
	return nil
}

func connectionWriteTarget(connection model.Connection, entries []model.Entry, parent, name string) error {
	if connection.ReadOnly {
		return ErrConnectionReadOnly
	}
	if !connectionRoot(entries, connection.RootID) || (connection.RootID != "" && !Within(entries, connection.RootID, parent)) {
		return ErrConnectionUnavailable
	}
	if !connection.BlockSystemFiles {
		return nil
	}
	if strings.HasPrefix(name, ".") {
		return ErrConnectionSystemFile
	}
	for remaining := len(entries) + 1; parent != "" && parent != connection.RootID && remaining > 0; remaining-- {
		entry, ok := model.Find(entries, parent)
		if !ok {
			return model.ErrMissing
		}
		if strings.HasPrefix(entry.Name, ".") {
			return ErrConnectionSystemFile
		}
		parent = entry.ParentID
	}
	return nil
}

// Ingest 接收由外部请求拥有的源；声明长度-1表示未知，失败时只清理本次候选。
func (s *Transfers) Ingest(ctx context.Context, connection model.Connection, parent, name string, declaredBytes int64, condition ContentCondition, source io.Reader) (entry model.Entry, created bool, resultErr error) {
	if source == nil || declaredBytes < -1 {
		return entry, false, model.ErrInvalid
	}
	if declaredBytes > s.policy.MaxFileBytes {
		return entry, false, model.ErrTooLarge
	}
	if err := s.connections.AuthorizePublication(ctx, connection.ID, connection.Revision); err != nil {
		return entry, false, err
	}
	normalized, err := s.files.newContentName(name)
	if err != nil {
		return entry, false, err
	}
	if err := s.sweep(ctx); err != nil {
		return entry, false, err
	}
	id, err := s.files.ids.New()
	if err != nil {
		return entry, false, err
	}
	now := s.files.clock.Now().UTC()
	expires := now.Add(s.policy.Lifetime)
	if connection.ExpiresAt.Before(expires) {
		expires = connection.ExpiresAt
	}
	var oldSize int64
	transfer, err := s.repo.ChangeTransfer(ctx, connection.OwnerID, "", string(model.TransferSourceWebDAV)+":"+id, func(snapshot TransferSnapshot) (model.Transfer, *model.Entry, error) {
		if snapshot.Transfer != nil {
			return model.Transfer{}, nil, model.ErrConflict
		}
		if err := model.Parent(snapshot.Entries, parent); err != nil {
			return model.Transfer{}, nil, err
		}
		if err := connectionWriteTarget(connection, snapshot.Entries, parent, name); err != nil {
			return model.Transfer{}, nil, err
		}
		var original *model.Entry
		for _, candidate := range snapshot.Entries {
			if candidate.ParentID == parent && candidate.NormalizedName == normalized && model.Visible(snapshot.Entries, candidate) {
				copy := candidate
				original = &copy
				break
			}
		}
		if original != nil && original.Kind != model.File {
			return model.Transfer{}, nil, model.ErrConflict
		}
		if original != nil {
			if original.ContentRevision >= model.MaxContentRevision {
				return model.Transfer{}, nil, model.ErrConflict
			}
			prepared, err := s.files.prepareReplacement(snapshot.Entries, *original, snapshot.HistoryPreferences)
			if err != nil {
				return model.Transfer{}, nil, err
			}
			oldSize = replacementCreditBytes(*original, prepared)
		}
		if err := checkContentCondition(original, condition); err != nil {
			return model.Transfer{}, nil, err
		}
		used := model.Used(snapshot.Entries)
		if used > s.files.policy.QuotaBytes || snapshot.OwnerReservedBytes > s.files.policy.QuotaBytes-used {
			return model.Transfer{}, nil, model.ErrQuota
		}
		remaining := s.files.policy.QuotaBytes - used - snapshot.OwnerReservedBytes
		if original != nil {
			if original.SizeBytes < 0 || original.SizeBytes > used || oldSize < 0 || oldSize > used {
				return model.Transfer{}, nil, fmt.Errorf("replacement size invariant")
			}
		}
		capacity := declaredBytes
		if declaredBytes < 0 {
			capacity = min(s.policy.MaxFileBytes, remaining+oldSize)
		}
		incremental := max(int64(0), capacity-oldSize)
		if incremental > remaining {
			return model.Transfer{}, nil, model.ErrQuota
		}
		if snapshot.OwnerReservedCount >= int64(s.policy.OwnerCount) || snapshot.GlobalReservedCount >= int64(s.policy.GlobalCount) || snapshot.GlobalReservedBytes > s.policy.StagingBytes || capacity > s.policy.StagingBytes-snapshot.GlobalReservedBytes {
			return model.Transfer{}, nil, model.ErrBusy
		}
		current := model.Transfer{ID: id, OwnerID: connection.OwnerID, ParentID: parent, Name: name, NormalizedName: normalized, SizeBytes: capacity, SizeKnown: declaredBytes >= 0, QuotaReservedBytes: incremental, Source: model.TransferSourceWebDAV, IdempotencyKey: string(model.TransferSourceWebDAV) + ":" + id, State: model.TransferPreparing, CreatedAt: now, UpdatedAt: now, ExpiresAt: expires, ObjectKey: "files/" + id, ConnectionID: connection.ID, ConnectionRevision: connection.Revision}
		current.DAVCondition, err = canonicalDAVCondition(s.files, snapshot.Entries, connection, condition.DAV)
		if err != nil {
			return model.Transfer{}, nil, err
		}
		if original != nil {
			current.ExpectedEntryID = original.ID
			current.ExpectedContentRevision = original.ContentRevision
		}
		return current, nil, nil
	})
	if err != nil {
		return entry, false, err
	}
	// 创建已持久化后，所有失败都在返回前尝试有界取消；已发布状态不能被取消删除。
	defer func() {
		if resultErr == nil {
			return
		}
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
		defer cancel()
		current, readErr := s.repo.ReadTransfer(cleanup, connection.OwnerID, transfer.ID)
		if readErr != nil {
			resultErr = errors.Join(resultErr, readErr)
			return
		}
		if current.State != model.TransferCompleted {
			_, cleanupErr := s.Cancel(cleanup, connection.OwnerID, transfer.ID)
			resultErr = errors.Join(resultErr, cleanupErr)
		}
	}()
	err = s.stage.WithLock(ctx, transfer.ID, func(ctx context.Context) error {
		if err := s.stage.CreateDeferred(ctx, transfer.ID); err != nil {
			return err
		}
		_, err := s.change(ctx, connection.OwnerID, transfer.ID, func(current *model.Transfer, _ []model.Entry) error {
			if current.State != model.TransferPreparing {
				return model.ErrConflict
			}
			current.State = model.TransferReceiving
			return nil
		})
		if err != nil {
			return err
		}
		written, digest, err := s.stage.WriteStream(ctx, transfer.ID, source, transfer.SizeBytes)
		if err != nil {
			return err
		}
		if declaredBytes >= 0 && written != declaredBytes {
			return io.ErrUnexpectedEOF
		}
		if err := s.stage.Seal(ctx, transfer.ID, written); err != nil {
			return err
		}
		_, err = s.change(ctx, connection.OwnerID, transfer.ID, func(current *model.Transfer, _ []model.Entry) error {
			if current.Source != model.TransferSourceWebDAV || current.State != model.TransferReceiving || current.ContentSHA256 != "" {
				return model.ErrConflict
			}
			current.SizeBytes = written
			current.SizeKnown = true
			current.QuotaReservedBytes = max(int64(0), written-oldSize)
			current.ContentSHA256 = digest
			return nil
		})
		return err
	})
	if err != nil {
		return entry, false, err
	}
	published, err := s.commit(ctx, connection.OwnerID, transfer.ID, model.TransferSourceWebDAV)
	if err != nil {
		return entry, false, err
	}
	detail, err := s.files.Detail(ctx, connection.OwnerID, published.EntryID)
	if err != nil {
		return entry, false, err
	}
	return detail.Entry, transfer.ExpectedEntryID == "", nil
}
