package repo

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

type downloadRecord model.DownloadTask

func (downloadRecord) TableName() string { return "files_download_tasks" }

// Downloads 借用传输仓库的数据库租约、存储身份与owner锁，不拥有连接或第二套预算。
type Downloads struct{ transfers *Transfers }

func NewDownloads(transfers *Transfers) (*Downloads, error) {
	if transfers == nil {
		return nil, model.ErrInvalid
	}
	return &Downloads{transfers: transfers}, nil
}

func readDownloadTask(db *gorm.DB, owner, id string) (model.DownloadTask, error) {
	var record downloadRecord
	err := db.First(&record, "owner_id = ? AND id = ?", owner, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.DownloadTask{}, model.ErrMissing
	}
	if err != nil {
		return model.DownloadTask{}, err
	}
	task := model.DownloadTask(record)
	if err := model.ValidateDownloadTask(task); err != nil {
		return model.DownloadTask{}, fmt.Errorf("download persistence invariant: %w", err)
	}
	return task, nil
}

func (r *Downloads) use(ctx context.Context, work func(*gorm.DB) error) error {
	return r.transfers.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.transfers.checkStorage(db); err != nil {
				return err
			}
			if err := r.transfers.checkStaging(db); err != nil {
				return err
			}
			return work(db)
		})
	})
}

func (r *Downloads) transaction(ctx context.Context, owner string, work func(*gorm.DB) error) error {
	if owner == "" {
		return model.ErrInvalid
	}
	return r.transfers.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.transfers.lockOwner(db, owner); err != nil {
				return err
			}
			if err := r.transfers.checkStaging(db); err != nil {
				return err
			}
			return work(db)
		})
	})
}

func (r *Downloads) CreateDownload(ctx context.Context, task model.DownloadTask, transfer model.Transfer, admit func(service.TransferSnapshot) error) (model.DownloadTask, error) {
	if model.ValidateDownloadTask(task) != nil || admit == nil || transfer.Source != model.TransferSourceOffline || transfer.DownloadID != task.ID || transfer.OwnerID != task.OwnerID {
		return model.DownloadTask{}, model.ErrInvalid
	}
	var result model.DownloadTask
	_, err := r.transfers.changeTransfer(ctx, task.OwnerID, "", transfer.IdempotencyKey, &task, func(snapshot service.TransferSnapshot) (model.Transfer, *model.Entry, error) {
		if snapshot.Transfer != nil {
			previous := snapshot.DownloadTask
			if previous == nil || previous.ClientKey != task.ClientKey || previous.SourceURI != task.SourceURI || previous.TargetParentID != task.TargetParentID || previous.RequestedName != task.RequestedName {
				return model.Transfer{}, nil, model.ErrConflict
			}
			result = *previous
			return *snapshot.Transfer, nil, nil
		}
		if err := admit(snapshot); err != nil {
			return model.Transfer{}, nil, err
		}
		result = task
		return transfer, nil, nil
	})
	return result, err
}

func downloadChildren(db *gorm.DB, owner, taskID string) ([]model.Transfer, error) {
	// 当前HTTP来源恰好一个文件；显式检查基数，不能把多文件数据静默截断。
	var records []transferRecord
	if err := db.Where("owner_id = ? AND download_id = ?", owner, taskID).Order("id ASC").Limit(2).Find(&records).Error; err != nil {
		return nil, err
	}
	if len(records) != 1 || records[0].Source != model.TransferSourceOffline {
		return nil, fmt.Errorf("download child ownership invariant")
	}
	return []model.Transfer{model.Transfer(records[0])}, nil
}

func downloadEntrySnapshot(db *gorm.DB, owner string, limit int) ([]model.Entry, bool, error) {
	var records []entryRecord
	if err := db.Where("owner_id = ?", owner).Limit(limit + 1).Find(&records).Error; err != nil {
		return nil, false, err
	}
	if len(records) > limit {
		return nil, true, nil
	}
	entries, err := entryModels(records)
	return entries, false, err
}

func (r *Downloads) snapshot(db *gorm.DB, owner, id string) (service.DownloadSnapshot, error) {
	task, err := readDownloadTask(db, owner, id)
	if err != nil {
		return service.DownloadSnapshot{}, err
	}
	children, err := downloadChildren(db, owner, id)
	if err != nil {
		return service.DownloadSnapshot{}, err
	}
	entries, limited, err := downloadEntrySnapshot(db, owner, r.transfers.metadataEntries)
	if err != nil {
		return service.DownloadSnapshot{}, err
	}
	var active int64
	if err := db.Model(&downloadRecord{}).Where("lease_token <> ? AND lease_until > ?", "", r.transfers.clock.Now().UTC()).Count(&active).Error; err != nil {
		return service.DownloadSnapshot{}, err
	}
	return service.DownloadSnapshot{MetadataLimited: limited, Task: task, Transfers: children, Entries: entries, GlobalActiveTasks: int(active)}, nil
}

func (r *Downloads) ReadDownload(ctx context.Context, owner, id string) (service.DownloadSnapshot, error) {
	if owner == "" || model.ValidateTransferID(id) != nil {
		return service.DownloadSnapshot{}, model.ErrInvalid
	}
	var result service.DownloadSnapshot
	err := r.use(ctx, func(db *gorm.DB) error { var err error; result, err = r.snapshot(db, owner, id); return err })
	return result, err
}

func (r *Downloads) ChangeDownload(ctx context.Context, owner, id string, change func(service.DownloadSnapshot) (model.DownloadTask, error)) (model.DownloadTask, error) {
	if model.ValidateTransferID(id) != nil || change == nil {
		return model.DownloadTask{}, model.ErrInvalid
	}
	var result model.DownloadTask
	err := r.transaction(ctx, owner, func(db *gorm.DB) error {
		snapshot, err := r.snapshot(db, owner, id)
		if err != nil {
			return err
		}
		changed, err := change(snapshot)
		if err != nil {
			return err
		}
		if err := saveDownloadChanges(db, snapshot.Task, changed); err != nil {
			return err
		}
		result = changed
		return nil
	})
	return result, err
}

func sameOptional[T comparable](left, right *T) bool {
	return left == nil && right == nil || left != nil && right != nil && *left == *right
}

// saveDownloadChanges 只更新回调实际改变的列。后台检查点可能在快照之后写入，不能全行覆盖。
func saveDownloadChanges(db *gorm.DB, previous, changed model.DownloadTask) error {
	if err := model.ValidateDownloadTask(changed); err != nil {
		return err
	}
	if changed.ID != previous.ID || changed.OwnerID != previous.OwnerID || changed.Kind != previous.Kind || changed.SourceURI != previous.SourceURI || changed.SourceOrigin != previous.SourceOrigin || changed.ClientKey != previous.ClientKey || !changed.CreatedAt.Equal(previous.CreatedAt) || !changed.ExpiresAt.Equal(previous.ExpiresAt) || changed.Revision < previous.Revision || changed.Revision > previous.Revision+1 {
		return fmt.Errorf("download immutable identity invariant")
	}
	columns := []string{}
	add := func(changed bool, column string) {
		if changed {
			columns = append(columns, column)
		}
	}
	add(changed.EffectiveURI != previous.EffectiveURI, "effective_uri")
	add(changed.TargetParentID != previous.TargetParentID, "target_parent_id")
	add(changed.RequestedName != previous.RequestedName, "requested_name")
	add(changed.State != previous.State, "state")
	add(changed.Intent != previous.Intent, "intent")
	add(changed.ValidatorKind != previous.ValidatorKind, "validator_kind")
	add(changed.ValidatorValue != previous.ValidatorValue, "validator_value")
	add(!sameOptional(changed.DeclaredBytes, previous.DeclaredBytes), "declared_bytes")
	add(changed.ReceivedBytes != previous.ReceivedBytes, "received_bytes")
	add(changed.RateBytesPerSecond != previous.RateBytesPerSecond, "rate_bytes_per_second")
	add(!sameOptional(changed.ProgressAt, previous.ProgressAt), "progress_at")
	add(changed.MediaType != previous.MediaType, "media_type")
	add(changed.FailureCode != previous.FailureCode, "failure_code")
	add(changed.SourceStatus != previous.SourceStatus, "source_status")
	add(changed.Attempts != previous.Attempts, "attempts")
	add(changed.LeaseToken != previous.LeaseToken, "lease_token")
	add(!sameOptional(changed.LeaseUntil, previous.LeaseUntil), "lease_until")
	add(changed.Revision != previous.Revision, "revision")
	add(!changed.UpdatedAt.Equal(previous.UpdatedAt), "updated_at")
	add(!sameOptional(changed.StartedAt, previous.StartedAt), "started_at")
	add(!sameOptional(changed.FinishedAt, previous.FinishedAt), "finished_at")
	if len(columns) == 0 {
		return nil
	}
	record := downloadRecord(changed)
	update := db.Model(&downloadRecord{}).Where("owner_id = ? AND id = ?", previous.OwnerID, previous.ID).Select(columns).Updates(&record)
	if update.Error != nil {
		return update.Error
	}
	if update.RowsAffected != 1 {
		return model.ErrMissing
	}
	return nil
}

func leaseQuery(db *gorm.DB, claim service.DownloadClaim, now time.Time) *gorm.DB {
	return db.Model(&downloadRecord{}).Where("owner_id = ? AND id = ? AND lease_token = ? AND lease_until > ? AND intent = ? AND state IN ?", claim.OwnerID, claim.TaskID, claim.Token, now, model.DownloadRun, []model.DownloadState{model.DownloadFetching, model.DownloadPublishing})
}

func validClaim(claim service.DownloadClaim) bool {
	return claim.OwnerID != "" && model.ValidateTransferID(claim.TaskID) == nil && model.ValidateTransferID(claim.Token) == nil
}

func (r *Downloads) RenewDownload(ctx context.Context, claim service.DownloadClaim, now, until time.Time) error {
	if !validClaim(claim) || !until.After(now) || until.Sub(now) > service.DefaultDownloadLeaseTTL {
		return model.ErrInvalid
	}
	return r.use(ctx, func(db *gorm.DB) error {
		update := leaseQuery(db, claim, now).UpdateColumn("lease_until", until)
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return model.ErrDownloadLeaseLost
		}
		return nil
	})
}

func (r *Downloads) CheckpointDownload(ctx context.Context, claim service.DownloadClaim, now time.Time, received int64, rate float64) error {
	if !validClaim(claim) || received < 0 || received > model.MaxFileContentBytes || !finiteRate(rate) {
		return model.ErrInvalid
	}
	return r.use(ctx, func(db *gorm.DB) error {
		record := downloadRecord{ReceivedBytes: received, RateBytesPerSecond: rate, ProgressAt: &now}
		update := leaseQuery(db, claim, now).Where("(declared_bytes IS NULL OR declared_bytes >= ?) AND received_bytes <= ?", received, received).Select("received_bytes", "rate_bytes_per_second", "progress_at").Updates(&record)
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return model.ErrDownloadLeaseLost
		}
		return nil
	})
}

func finiteRate(rate float64) bool {
	return rate >= 0 && rate <= float64(model.MaxFileContentBytes)*1e9
}

func (r *Downloads) RetargetDownload(ctx context.Context, owner, id string, revision int64, parent, name, normalized string, validate func(service.DownloadSnapshot) error) (model.DownloadTask, error) {
	if model.ValidateTransferID(id) != nil || revision < 1 || revision >= model.MaxDownloadRevision || model.ValidateName(name) != nil || normalized == "" || validate == nil || parent != "" && model.ValidateTransferID(parent) != nil {
		return model.DownloadTask{}, model.ErrInvalid
	}
	var result model.DownloadTask
	err := r.transaction(ctx, owner, func(db *gorm.DB) error {
		snapshot, err := r.snapshot(db, owner, id)
		if err != nil {
			return err
		}
		if snapshot.Task.Revision != revision {
			return model.ErrConflict
		}
		if err := validate(snapshot); err != nil {
			return err
		}
		child := snapshot.Transfers[0]
		if child.Terminal() || snapshot.Task.LeaseValid(r.transfers.clock.Now().UTC()) || snapshot.Task.State != model.DownloadPaused && snapshot.Task.State != model.DownloadFailed {
			return model.ErrConflict
		}
		child.ParentID, child.Name, child.NormalizedName = parent, name, normalized
		child.Revision++
		record := transferRecord(child)
		if err := db.Model(&transferRecord{}).Where("owner_id = ? AND id = ?", owner, child.ID).Select("parent_id", "name", "normalized_name", "revision").Updates(&record).Error; err != nil {
			return err
		}
		result = snapshot.Task
		result.TargetParentID, result.RequestedName = parent, name
		result.Revision++
		result.UpdatedAt = r.transfers.clock.Now().UTC()
		return saveDownloadChanges(db, snapshot.Task, result)
	})
	return result, err
}

func (r *Downloads) DeleteDownload(ctx context.Context, claim service.DownloadClaim, validate func(service.DownloadSnapshot) error) error {
	if !validClaim(claim) || validate == nil {
		return model.ErrInvalid
	}
	owner, id := claim.OwnerID, claim.TaskID
	return r.transaction(ctx, owner, func(db *gorm.DB) error {
		snapshot, err := r.snapshot(db, owner, id)
		if err != nil {
			return err
		}
		if err := validate(snapshot); err != nil {
			return err
		}
		if !snapshot.Task.State.Finished() {
			return model.ErrConflict
		}
		if snapshot.Task.LeaseToken != claim.Token || !snapshot.Task.LeaseValid(r.transfers.clock.Now()) {
			return model.ErrDownloadLeaseLost
		}
		for _, child := range snapshot.Transfers {
			if !child.Terminal() || child.CleanupPending {
				return model.ErrConflict
			}
		}
		if err := db.Where("owner_id = ? AND download_id = ?", owner, id).Delete(&transferRecord{}).Error; err != nil {
			return err
		}
		return db.Where("owner_id = ? AND id = ?", owner, id).Delete(&downloadRecord{}).Error
	})
}

func (r *Downloads) NextDownload(ctx context.Context, now time.Time, maxAttempts int) (service.DownloadCandidate, bool, error) {
	if maxAttempts < 1 || maxAttempts > model.MaxDownloadAttempts {
		return service.DownloadCandidate{}, false, model.ErrInvalid
	}
	var record downloadRecord
	err := r.use(ctx, func(db *gorm.DB) error {
		// 有清理债务的完成项、取消/过期意图也由同一任务所有者处理。
		return db.Where("(lease_until IS NULL OR lease_until <= ?)", now).
			Where("((intent = ? AND state IN ?) OR (attempts >= ? AND state IN ?) OR (attempts < ? AND ((intent = ? AND state = ?) OR (intent = ? AND state NOT IN ?) OR (expires_at <= ? AND state NOT IN ?) OR EXISTS (SELECT 1 FROM files_transfers WHERE files_transfers.download_id = files_download_tasks.id AND files_transfers.owner_id = files_download_tasks.owner_id AND cleanup_pending = ?))))",
				model.DownloadRun, []model.DownloadState{model.DownloadQueued, model.DownloadFetching, model.DownloadPublishing}, maxAttempts, []model.DownloadState{model.DownloadQueued, model.DownloadFetching, model.DownloadPausing, model.DownloadPublishing}, maxAttempts, model.DownloadPause, model.DownloadPausing, model.DownloadCancel, []model.DownloadState{model.DownloadCompleted, model.DownloadCanceled, model.DownloadExpired}, now, []model.DownloadState{model.DownloadCompleted, model.DownloadCanceled, model.DownloadExpired}, true).
			Order("updated_at ASC").Order("id ASC").First(&record).Error
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return service.DownloadCandidate{}, false, nil
	}
	if err != nil {
		return service.DownloadCandidate{}, false, err
	}
	if err := model.ValidateDownloadTask(model.DownloadTask(record)); err != nil {
		return service.DownloadCandidate{}, false, err
	}
	return service.DownloadCandidate{ID: record.ID, OwnerID: record.OwnerID}, true, nil
}

type downloadCursor struct {
	CreatedAt time.Time `json:"createdAt"`
	ID        string    `json:"id"`
}

const maxDownloadCursorBytes = 256
const maxDownloadSearchRunes = 200

func decodeDownloadCursor(value string) (downloadCursor, error) {
	var cursor downloadCursor
	if value == "" {
		return cursor, nil
	}
	if len(value) > maxDownloadCursorBytes {
		return cursor, model.ErrInvalid
	}
	payload, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return cursor, errors.Join(model.ErrInvalid, err)
	}
	decoder := json.NewDecoder(strings.NewReader(string(payload)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&cursor); err != nil {
		return cursor, errors.Join(model.ErrInvalid, err)
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return cursor, errors.Join(model.ErrInvalid, err)
	}
	if model.ValidateTransferID(cursor.ID) != nil || cursor.CreatedAt.IsZero() {
		return cursor, model.ErrInvalid
	}
	return cursor, nil
}

func finishedDownloadStates() []model.DownloadState {
	return []model.DownloadState{model.DownloadCompleted, model.DownloadFailed, model.DownloadCanceled, model.DownloadExpired}
}

func (r *Downloads) ListDownloads(ctx context.Context, owner string, query service.DownloadQuery, limit int) (service.DownloadPage, error) {
	page := service.DownloadPage{Tasks: []model.DownloadTask{}, Transfers: []model.Transfer{}, Entries: []model.Entry{}}
	if owner == "" || limit < 1 || limit > service.DefaultDownloadPageSize || utf8.RuneCountInString(query.Search) > maxDownloadSearchRunes || !utf8.ValidString(query.Search) || query.State != "" && !query.State.Valid() {
		return page, model.ErrInvalid
	}
	cursor, err := decodeDownloadCursor(query.Cursor)
	if err != nil {
		return page, err
	}
	err = r.use(ctx, func(db *gorm.DB) error {
		base := db.Model(&downloadRecord{}).Where("owner_id = ?", owner)
		var total, finished int64
		if err := base.Session(&gorm.Session{}).Count(&total).Error; err != nil {
			return err
		}
		if err := base.Session(&gorm.Session{}).Where("state IN ?", finishedDownloadStates()).Count(&finished).Error; err != nil {
			return err
		}
		page.TotalCount, page.FinishedCount, page.ActiveCount = int(total), int(finished), int(total-finished)
		filtered := base.Session(&gorm.Session{})
		switch query.Section {
		case "", "all":
		case "active":
			filtered = filtered.Where("state NOT IN ?", finishedDownloadStates())
		case "finished":
			filtered = filtered.Where("state IN ?", finishedDownloadStates())
		default:
			return model.ErrInvalid
		}
		if query.State != "" {
			filtered = filtered.Where("state = ?", query.State)
		}
		if query.Search != "" {
			// 不把私有完整URL纳入检索或返回；通配字符转义为字面量。
			needle := "%" + strings.NewReplacer("!", "!!", "%", "!%", "_", "!_").Replace(strings.ToLower(query.Search)) + "%"
			filtered = filtered.Where("(LOWER(requested_name) LIKE ? ESCAPE '!' OR LOWER(source_origin) LIKE ? ESCAPE '!' OR EXISTS (SELECT 1 FROM files_transfers WHERE files_transfers.download_id = files_download_tasks.id AND files_transfers.owner_id = files_download_tasks.owner_id AND LOWER(files_transfers.name) LIKE ? ESCAPE '!'))", needle, needle, needle)
		}
		if cursor.ID != "" {
			filtered = filtered.Where("created_at < ? OR (created_at = ? AND id < ?)", cursor.CreatedAt, cursor.CreatedAt, cursor.ID)
		}
		var records []downloadRecord
		if err := filtered.Order("created_at DESC").Order("id DESC").Limit(limit + 1).Find(&records).Error; err != nil {
			return err
		}
		if len(records) > limit {
			records = records[:limit]
			last := records[len(records)-1]
			encoded, err := json.Marshal(downloadCursor{CreatedAt: last.CreatedAt, ID: last.ID})
			if err != nil {
				return err
			}
			page.NextCursor = base64.RawURLEncoding.EncodeToString(encoded)
		}
		for _, record := range records {
			task := model.DownloadTask(record)
			if err := model.ValidateDownloadTask(task); err != nil {
				return err
			}
			children, err := downloadChildren(db, owner, task.ID)
			if err != nil {
				return err
			}
			page.Tasks = append(page.Tasks, task)
			page.Transfers = append(page.Transfers, children...)
		}
		var err error
		page.Entries, page.MetadataLimited, err = downloadEntrySnapshot(db, owner, r.transfers.metadataEntries)
		return err
	})
	return page, err
}

var _ service.DownloadRepository = (*Downloads)(nil)
