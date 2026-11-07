package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	transferFailureStaging     = "staging"
	transferFailureChecksum    = "checksum"
	transferFailureDestination = "destination"
	transferFailureQuota       = "quota"
	transferFailureStorage     = "storage"
	transferMIMESniffBytes     = 512
)

var (
	ErrTransferExpired  = errors.New("transfer expired")
	ErrTransferChecksum = errors.New("transfer checksum mismatch")
)

// TransferContent 是发布阶段消费的有界存储能力，不暴露共享资源关闭权。
type TransferContent interface {
	PutReader(context.Context, string, io.ReadSeeker, int64, string) error
	Delete(context.Context, string) error
}

type ConnectionPublicationAuthority interface {
	AuthorizePublication(context.Context, string, int64) error
}

// Transfers 拥有持久上传业务；Staging 和协议库不拥有身份、配额或发布决策。
type Transfers struct {
	files       *Service
	repo        TransferRepository
	stage       Staging
	content     TransferContent
	policy      TransferPolicy
	connections ConnectionPublicationAuthority
}

func (s *Transfers) ChunkBytes() int64 { return s.policy.ChunkBytes }

func NewTransfers(files *Service, repository TransferRepository, stage Staging, content TransferContent, connections ConnectionPublicationAuthority, policy TransferPolicy) (*Transfers, error) {
	if files == nil || repository == nil || stage == nil || content == nil || connections == nil {
		return nil, fmt.Errorf("transfer dependencies incomplete")
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	if policy.MaxFileBytes > files.policy.QuotaBytes {
		return nil, fmt.Errorf("transfer file limit exceeds account quota")
	}
	return &Transfers{files: files, repo: repository, stage: stage, content: content, connections: connections, policy: policy}, nil
}

type TransferRequest struct {
	ParentID                string `json:"parentId"`
	Name                    string `json:"name"`
	SizeBytes               int64  `json:"sizeBytes"`
	SHA256                  string `json:"sha256"`
	Key                     string `json:"key"`
	ExpectedEntryID         string `json:"expectedEntryId,omitempty" maxLength:"36"`
	ExpectedContentRevision int64  `json:"expectedContentRevision,omitempty" minimum:"0" maximum:"9007199254740991"`
}
type TransferSummary struct {
	ID                      string               `json:"id"`
	ClientKey               string               `json:"clientKey"`
	ParentID                string               `json:"parentId"`
	DestinationPath         string               `json:"destinationPath"`
	DestinationAvailable    bool                 `json:"destinationAvailable"`
	Name                    string               `json:"name"`
	SizeBytes               int64                `json:"sizeBytes"`
	SizeKnown               bool                 `json:"sizeKnown"`
	Source                  model.TransferSource `json:"source"`
	OffsetBytes             int64                `json:"offsetBytes"`
	State                   model.TransferState  `json:"state"`
	FailureCode             string               `json:"failureCode"`
	EntryID                 string               `json:"entryId"`
	CreatedAt               time.Time            `json:"createdAt"`
	UpdatedAt               time.Time            `json:"updatedAt"`
	ExpiresAt               time.Time            `json:"expiresAt"`
	Revision                int64                `json:"revision"`
	CleanupPending          bool                 `json:"cleanupPending"`
	ExpectedEntryID         string               `json:"expectedEntryId"`
	ExpectedContentRevision int64                `json:"expectedContentRevision"`
}
type TransferListing struct {
	Items             []TransferSummary `json:"items"`
	NextCursor        string            `json:"nextCursor"`
	ChunkBytes        int64             `json:"chunkBytes"`
	MaxFileBytes      int64             `json:"maxFileBytes"`
	MaxQueueEntries   int               `json:"maxQueueEntries"`
	ConcurrentUploads int               `json:"concurrentUploads"`
}

func (s *Transfers) summary(ctx context.Context, transfer model.Transfer) (TransferSummary, error) {
	destination, available := "/", true
	if transfer.ParentID != "" && transfer.Source != model.TransferSourceShare {
		detail, err := s.files.Detail(ctx, transfer.OwnerID, transfer.ParentID)
		if err != nil {
			if !errors.Is(err, model.ErrMissing) {
				return TransferSummary{}, err
			}
			destination, available = "", false
		} else {
			names := make([]string, 0, len(detail.Breadcrumbs)+1)
			for _, entry := range detail.Breadcrumbs {
				names = append(names, entry.Name)
			}
			names = append(names, detail.Entry.Name)
			destination = "/" + strings.Join(names, "/")
		}
	}
	offset := int64(0)
	if transfer.State == model.TransferCompleted {
		offset = transfer.SizeBytes
	} else if !transfer.Terminal() {
		info, err := s.stage.Inspect(ctx, transfer.ID)
		if err != nil {
			if transfer.State != model.TransferPreparing || !errors.Is(err, model.ErrMissing) {
				return TransferSummary{}, err
			}
		} else {
			if !info.Deferred && info.SizeBytes != transfer.SizeBytes {
				return TransferSummary{}, fmt.Errorf("transfer source size changed")
			}
			offset = info.OffsetBytes
		}
	}
	return TransferSummary{ID: transfer.ID, ClientKey: transfer.IdempotencyKey, ParentID: transfer.ParentID, DestinationPath: destination, DestinationAvailable: available, Name: transfer.Name, SizeBytes: transfer.SizeBytes, SizeKnown: transfer.SizeKnown, Source: transfer.Source, OffsetBytes: offset, State: transfer.State, FailureCode: transfer.FailureCode, EntryID: transfer.EntryID, CreatedAt: transfer.CreatedAt, UpdatedAt: transfer.UpdatedAt, ExpiresAt: transfer.ExpiresAt, Revision: transfer.Revision, CleanupPending: transfer.CleanupPending, ExpectedEntryID: transfer.ExpectedEntryID, ExpectedContentRevision: transfer.ExpectedContentRevision}, nil
}

func (s *Transfers) Create(ctx context.Context, owner string, input TransferRequest) (TransferSummary, error) {
	return s.createAuthorized(ctx, owner, input, nil)
}

func (s *Transfers) createAuthorized(ctx context.Context, owner string, input TransferRequest, share *sharePublication) (TransferSummary, error) {
	source := model.TransferSourceTus
	changeTransfer := func(apply func(TransferSnapshot) (model.Transfer, *model.Entry, error)) (model.Transfer, error) {
		return s.repo.ChangeTransfer(ctx, owner, "", input.Key, apply)
	}
	if share != nil {
		if input.ExpectedEntryID != "" {
			return TransferSummary{}, model.ErrInvalid
		}
		source = model.TransferSourceShare
		if err := share.authorize(ctx, s.files.clock.Now()); err != nil {
			return TransferSummary{}, err
		}
		changeTransfer = func(apply func(TransferSnapshot) (model.Transfer, *model.Entry, error)) (model.Transfer, error) {
			return s.repo.ChangeShareTransfer(ctx, owner, input.Key, share.access, apply)
		}
	}
	if (input.ExpectedEntryID == "" && input.ExpectedContentRevision != 0) || (input.ExpectedEntryID != "" && (input.ExpectedContentRevision < 1 || input.ExpectedContentRevision >= model.MaxContentRevision)) {
		return TransferSummary{}, model.ErrInvalid
	}
	if owner == "" {
		return TransferSummary{}, model.ErrMissing
	}
	normalized, err := s.files.normalizedName(input.Name)
	if err != nil {
		return TransferSummary{}, err
	}
	digest, err := hex.DecodeString(input.SHA256)
	if err != nil || len(digest) != sha256.Size || hex.EncodeToString(digest) != input.SHA256 || len(input.Key) < 16 || len(input.Key) > 128 || strings.IndexFunc(input.Key, func(r rune) bool { return r < 33 || r > 126 }) >= 0 {
		return TransferSummary{}, model.ErrInvalid
	}
	if input.SizeBytes < 0 || input.SizeBytes > DefaultMaxFileBytes {
		return TransferSummary{}, model.ErrTooLarge
	}
	if err := s.sweep(ctx); err != nil {
		return TransferSummary{}, err
	}
	id, err := s.files.ids.New()
	if err != nil {
		return TransferSummary{}, err
	}
	if err := model.ValidateTransferID(id); err != nil {
		return TransferSummary{}, err
	}
	now := s.files.clock.Now().UTC()
	transfer, err := changeTransfer(func(snapshot TransferSnapshot) (model.Transfer, *model.Entry, error) {
		if share != nil {
			if err := share.validateAdmission(ctx, snapshot); err != nil {
				return model.Transfer{}, nil, err
			}
		}
		if previous := snapshot.Transfer; previous != nil {
			if previous.Source != source || (share != nil && (previous.ShareID != share.access.ShareID || previous.ShareRevision != share.access.ShareRevision || previous.ShareGrantDigest != share.access.GrantDigest || previous.ShareAudienceSubject != share.access.AudienceSubject)) || previous.ParentID != input.ParentID || previous.NormalizedName != normalized || previous.ContentSHA256 != input.SHA256 || previous.SizeBytes != input.SizeBytes || previous.ExpectedEntryID != input.ExpectedEntryID || previous.ExpectedContentRevision != input.ExpectedContentRevision {
				return model.Transfer{}, nil, model.ErrConflict
			}
			return *previous, nil, nil
		}
		if input.SizeBytes > s.policy.MaxFileBytes {
			return model.Transfer{}, nil, model.ErrTooLarge
		}
		if err := model.Parent(snapshot.Entries, input.ParentID); err != nil {
			return model.Transfer{}, nil, err
		}
		if err := model.Available(snapshot.Entries, input.ExpectedEntryID, input.ParentID, normalized); err != nil {
			return model.Transfer{}, nil, err
		}
		used := model.Used(snapshot.Entries)
		reserved := input.SizeBytes
		if input.ExpectedEntryID != "" {
			original, exists := model.Find(snapshot.Entries, input.ExpectedEntryID)
			if !exists || !model.Visible(snapshot.Entries, original) || original.Kind != model.File || original.ContentRevision != input.ExpectedContentRevision || original.ParentID != input.ParentID || original.NormalizedName != normalized {
				return model.Transfer{}, nil, model.ErrConflict
			}
			prepared, err := s.files.prepareReplacement(snapshot.Entries, original, snapshot.HistoryPreferences)
			if err != nil {
				return model.Transfer{}, nil, err
			}
			reserved = s.files.replacementGrowth(original, prepared, input.SizeBytes)
		}
		if used > s.files.policy.QuotaBytes || snapshot.OwnerReservedBytes > s.files.policy.QuotaBytes-used || reserved > s.files.policy.QuotaBytes-used-snapshot.OwnerReservedBytes {
			return model.Transfer{}, nil, model.ErrQuota
		}
		if snapshot.OwnerReservedCount >= int64(s.policy.OwnerCount) || snapshot.GlobalReservedCount >= int64(s.policy.GlobalCount) || snapshot.GlobalReservedBytes > s.policy.StagingBytes || input.SizeBytes > s.policy.StagingBytes-snapshot.GlobalReservedBytes {
			return model.Transfer{}, nil, model.ErrBusy
		}
		current := model.Transfer{ID: id, OwnerID: owner, ParentID: input.ParentID, Name: input.Name, NormalizedName: normalized, SizeBytes: input.SizeBytes, SizeKnown: true, QuotaReservedBytes: reserved, Source: source, ContentSHA256: input.SHA256, IdempotencyKey: input.Key, State: model.TransferPreparing, CreatedAt: now, UpdatedAt: now, ExpiresAt: now.Add(s.policy.Lifetime), ObjectKey: "files/" + id, ExpectedEntryID: input.ExpectedEntryID, ExpectedContentRevision: input.ExpectedContentRevision}
		if share != nil {
			current.ShareID = share.access.ShareID
			current.ShareRevision = share.access.ShareRevision
			current.ShareGrantDigest = share.access.GrantDigest
			current.ShareAudienceSubject = share.access.AudienceSubject
			if snapshot.Share.ExpiresAt.Before(current.ExpiresAt) {
				current.ExpiresAt = snapshot.Share.ExpiresAt
			}
			if snapshot.ShareGrant != nil && snapshot.ShareGrant.ExpiresAt.Before(current.ExpiresAt) {
				current.ExpiresAt = snapshot.ShareGrant.ExpiresAt
			}
		}
		return current, nil, nil
	})
	if err != nil {
		return TransferSummary{}, err
	}
	var result TransferSummary
	err = s.stage.WithLock(ctx, transfer.ID, func(ctx context.Context) error {
		current, err := s.repo.ReadTransfer(ctx, owner, transfer.ID)
		if err != nil {
			return err
		}
		current, err = s.expireLocked(ctx, current)
		if err != nil {
			return err
		}
		if current.State == model.TransferExpired {
			return ErrTransferExpired
		}
		if current.State == model.TransferPreparing {
			if err := s.stage.Create(ctx, current.ID, current.SizeBytes); err != nil {
				return errors.Join(err, s.recordFailure(ctx, owner, current.ID, transferFailureStaging, false))
			}
			current, err = s.change(ctx, owner, current.ID, func(transfer *model.Transfer, _ []model.Entry) error {
				if transfer.State != model.TransferPreparing {
					return model.ErrConflict
				}
				transfer.State = model.TransferReceiving
				transfer.FailureCode = ""
				return nil
			})
			if err != nil {
				return err
			}
		}
		result, err = s.summary(ctx, current)
		return err
	})
	if err != nil && share != nil {
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
		defer cancel()
		_, cleanupErr := s.cancelSource(cleanup, owner, transfer.ID, model.TransferSourceShare)
		return result, errors.Join(err, cleanupErr)
	}
	return result, err
}

func (s *Transfers) change(ctx context.Context, owner, id string, apply func(*model.Transfer, []model.Entry) error) (model.Transfer, error) {
	return s.repo.ChangeTransfer(ctx, owner, id, "", func(snapshot TransferSnapshot) (model.Transfer, *model.Entry, error) {
		if snapshot.Transfer == nil {
			return model.Transfer{}, nil, model.ErrMissing
		}
		current := *snapshot.Transfer
		if err := apply(&current, snapshot.Entries); err != nil {
			return model.Transfer{}, nil, err
		}
		current.UpdatedAt = s.files.clock.Now().UTC()
		return current, nil, nil
	})
}

func (s *Transfers) recordFailure(ctx context.Context, owner, id, code string, attention bool) error {
	cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer cancel()
	_, err := s.change(cleanup, owner, id, func(transfer *model.Transfer, _ []model.Entry) error {
		if transfer.Terminal() {
			return nil
		}
		transfer.FailureCode = code
		if attention {
			transfer.State = model.TransferAttention
		}
		return nil
	})
	return err
}

// cleanupLocked 只清理当前会话的暂存与未发布候选，失败时预算仍被持久占用。
func (s *Transfers) cleanupLocked(ctx context.Context, transfer model.Transfer) (model.Transfer, error) {
	if !transfer.Terminal() || !transfer.CleanupPending {
		return transfer, nil
	}
	err := s.stage.Remove(ctx, transfer.ID)
	if transfer.State != model.TransferCompleted {
		err = errors.Join(err, s.content.Delete(ctx, transfer.ObjectKey))
	}
	if err != nil {
		return transfer, errors.Join(ErrCleanup, err)
	}
	return s.change(ctx, transfer.OwnerID, transfer.ID, func(current *model.Transfer, _ []model.Entry) error {
		if !current.Terminal() {
			return model.ErrConflict
		}
		current.CleanupPending = false
		return nil
	})
}

func (s *Transfers) expireLocked(ctx context.Context, transfer model.Transfer) (model.Transfer, error) {
	if !transfer.Terminal() && !s.files.clock.Now().Before(transfer.ExpiresAt) {
		var err error
		transfer, err = s.change(ctx, transfer.OwnerID, transfer.ID, func(current *model.Transfer, _ []model.Entry) error {
			if current.Terminal() {
				return nil
			}
			current.State = model.TransferExpired
			current.CleanupPending = true
			return nil
		})
		if err != nil {
			return model.Transfer{}, err
		}
	}
	return s.cleanupLocked(ctx, transfer)
}

func (s *Transfers) Read(ctx context.Context, owner, id string) (TransferSummary, error) {
	return s.readSource(ctx, owner, id, "")
}

func (s *Transfers) readSource(ctx context.Context, owner, id string, source model.TransferSource) (TransferSummary, error) {
	// 在获取磁盘锁前先做 owner 查询，未知/他人 ID 不产生锁文件。
	if current, err := s.repo.ReadTransfer(ctx, owner, id); err != nil {
		return TransferSummary{}, err
	} else if (source != "" && current.Source != source) || (source == "" && (current.Source == model.TransferSourceOffline || current.Source == model.TransferSourceShare)) {
		return TransferSummary{}, model.ErrMissing
	}
	var result TransferSummary
	err := s.stage.WithLock(ctx, id, func(ctx context.Context) error {
		transfer, err := s.repo.ReadTransfer(ctx, owner, id)
		if err != nil {
			return err
		}
		transfer, err = s.expireLocked(ctx, transfer)
		if err != nil {
			return err
		}
		result, err = s.summary(ctx, transfer)
		return err
	})
	return result, err
}

func (s *Transfers) List(ctx context.Context, owner, state, cursor string, limit int) (TransferListing, error) {
	if owner == "" {
		return TransferListing{}, model.ErrMissing
	}
	if err := s.sweep(ctx); err != nil {
		return TransferListing{}, err
	}
	page, err := s.repo.ListTransfers(ctx, owner, state, cursor, limit)
	if err != nil {
		return TransferListing{}, err
	}
	result := TransferListing{Items: []TransferSummary{}, NextCursor: page.NextCursor, ChunkBytes: s.policy.ChunkBytes, MaxFileBytes: s.policy.MaxFileBytes, MaxQueueEntries: s.files.policy.MaxBatchEntries, ConcurrentUploads: s.files.policy.ConcurrentUploads}
	for _, transfer := range page.Items {
		// 列表不排队争用正在写入的锁；文件长度是用于显示的真实瞬时进度。
		item, err := s.summary(ctx, transfer)
		if err != nil {
			return TransferListing{}, err
		}
		result.Items = append(result.Items, item)
	}
	return result, nil
}

func (s *Transfers) sweep(ctx context.Context) error {
	transfers, err := s.repo.CleanupTransfers(ctx, s.files.clock.Now().UTC(), DefaultTransferSweepCount)
	if err != nil {
		return err
	}
	for _, candidate := range transfers {
		if err := s.stage.WithLock(ctx, candidate.ID, func(ctx context.Context) error {
			current, err := s.repo.ReadTransfer(ctx, candidate.OwnerID, candidate.ID)
			if err != nil {
				return err
			}
			_, err = s.expireLocked(ctx, current)
			return err
		}); err != nil {
			return err
		}
	}
	return nil
}

// MatchSource 在重选文件时验证完整摘要与长度，名称和修改时间不作为内容证明。
func (s *Transfers) MatchSource(ctx context.Context, owner, id, digest string, sizeBytes int64) (TransferSummary, error) {
	transfer, err := s.repo.ReadTransfer(ctx, owner, id)
	if err != nil {
		return TransferSummary{}, err
	}
	if digest != transfer.ContentSHA256 || sizeBytes != transfer.SizeBytes {
		return TransferSummary{}, ErrTransferChecksum
	}
	if transfer.Source != model.TransferSourceTus {
		return TransferSummary{}, model.ErrConflict
	}
	return s.Read(ctx, owner, id)
}

// RunReceiving 把状态校验与整个协议请求放在同一锁内，避免暂停/取消竞态。
func (s *Transfers) RunReceiving(ctx context.Context, owner, id string, use func(context.Context) error) error {
	return s.runReceivingSource(ctx, owner, id, model.TransferSourceTus, use)
}

func (s *Transfers) runReceivingSource(ctx context.Context, owner, id string, source model.TransferSource, use func(context.Context) error) error {
	if use == nil {
		return model.ErrInvalid
	}
	if _, err := s.repo.ReadTransfer(ctx, owner, id); err != nil {
		return err
	}
	return s.stage.WithLock(ctx, id, func(ctx context.Context) error {
		transfer, err := s.repo.ReadTransfer(ctx, owner, id)
		if err != nil {
			return err
		}
		transfer, err = s.expireLocked(ctx, transfer)
		if err != nil {
			return err
		}
		if transfer.State == model.TransferExpired {
			return ErrTransferExpired
		}
		if transfer.Source != source || transfer.State != model.TransferReceiving {
			return model.ErrConflict
		}
		return use(ctx)
	})
}

func (s *Transfers) Pause(ctx context.Context, owner, id string) (TransferSummary, error) {
	return s.setPaused(ctx, owner, id, true)
}
func (s *Transfers) Resume(ctx context.Context, owner, id string) (TransferSummary, error) {
	return s.setPaused(ctx, owner, id, false)
}
func (s *Transfers) setPaused(ctx context.Context, owner, id string, paused bool) (TransferSummary, error) {
	if _, err := s.repo.ReadTransfer(ctx, owner, id); err != nil {
		return TransferSummary{}, err
	}
	var result TransferSummary
	err := s.stage.WithLock(ctx, id, func(ctx context.Context) error {
		transfer, err := s.repo.ReadTransfer(ctx, owner, id)
		if err != nil {
			return err
		}
		transfer, err = s.expireLocked(ctx, transfer)
		if err != nil {
			return err
		}
		if transfer.State == model.TransferExpired {
			return ErrTransferExpired
		}
		transfer, err = s.change(ctx, owner, id, func(current *model.Transfer, _ []model.Entry) error {
			if current.Source != model.TransferSourceTus || (current.State != model.TransferReceiving && current.State != model.TransferPaused) {
				return model.ErrConflict
			}
			if paused {
				current.State = model.TransferPaused
			} else {
				current.State = model.TransferReceiving
			}
			return nil
		})
		if err != nil {
			return err
		}
		result, err = s.summary(ctx, transfer)
		return err
	})
	return result, err
}

func (s *Transfers) Cancel(ctx context.Context, owner, id string) (TransferSummary, error) {
	return s.cancelSource(ctx, owner, id, "")
}

func (s *Transfers) cancelSource(ctx context.Context, owner, id string, source model.TransferSource) (TransferSummary, error) {
	if current, err := s.repo.ReadTransfer(ctx, owner, id); err != nil {
		return TransferSummary{}, err
	} else if (source != "" && current.Source != source) || (source == "" && (current.Source == model.TransferSourceOffline || current.Source == model.TransferSourceShare)) {
		return TransferSummary{}, model.ErrMissing
	}
	var result TransferSummary
	err := s.stage.WithLock(ctx, id, func(ctx context.Context) error {
		transfer, err := s.change(ctx, owner, id, func(current *model.Transfer, _ []model.Entry) error {
			if current.State == model.TransferCompleted {
				return model.ErrConflict
			}
			current.State = model.TransferCanceled
			current.CleanupPending = true
			return nil
		})
		if err != nil {
			return err
		}
		transfer, err = s.cleanupLocked(ctx, transfer)
		if err != nil {
			return err
		}
		result, err = s.summary(ctx, transfer)
		return err
	})
	return result, err
}

func (s *Transfers) Retarget(ctx context.Context, owner, id, parent, name string) (TransferSummary, error) {
	normalized, err := s.files.normalizedName(name)
	if err != nil {
		return TransferSummary{}, err
	}
	if current, err := s.repo.ReadTransfer(ctx, owner, id); err != nil {
		return TransferSummary{}, err
	} else if current.Source != model.TransferSourceTus || current.ExpectedEntryID != "" {
		return TransferSummary{}, model.ErrConflict
	}
	var result TransferSummary
	err = s.stage.WithLock(ctx, id, func(ctx context.Context) error {
		transfer, err := s.repo.ReadTransfer(ctx, owner, id)
		if err != nil {
			return err
		}
		transfer, err = s.expireLocked(ctx, transfer)
		if err != nil {
			return err
		}
		if transfer.State == model.TransferExpired {
			return ErrTransferExpired
		}
		transfer, err = s.change(ctx, owner, id, func(current *model.Transfer, entries []model.Entry) error {
			if current.State != model.TransferAttention {
				return model.ErrConflict
			}
			if err := model.Parent(entries, parent); err != nil {
				return err
			}
			if err := model.Available(entries, "", parent, normalized); err != nil {
				return err
			}
			current.Name = name
			current.NormalizedName = normalized
			current.ParentID = parent
			current.FailureCode = ""
			return nil
		})
		if err != nil {
			return err
		}
		result, err = s.summary(ctx, transfer)
		return err
	})
	return result, err
}

func (s *Transfers) Commit(ctx context.Context, owner, id string) (TransferSummary, error) {
	return s.commit(ctx, owner, id, model.TransferSourceTus)
}

func (s *Transfers) commit(ctx context.Context, owner, id string, sourceKind model.TransferSource) (TransferSummary, error) {
	return s.commitAuthorized(ctx, owner, id, sourceKind, nil)
}

func (s *Transfers) commitAuthorized(ctx context.Context, owner, id string, sourceKind model.TransferSource, publication transferPublication) (TransferSummary, error) {
	if ((sourceKind == model.TransferSourceOffline || sourceKind == model.TransferSourceShare) != (publication != nil)) || publication != nil && publication.source() != sourceKind {
		return TransferSummary{}, model.ErrInvalid
	}
	if _, err := s.repo.ReadTransfer(ctx, owner, id); err != nil {
		return TransferSummary{}, err
	}
	var result TransferSummary
	err := s.stage.WithLock(ctx, id, func(ctx context.Context) error {
		transfer, err := s.repo.ReadTransfer(ctx, owner, id)
		if err != nil {
			return err
		}
		transfer, err = s.expireLocked(ctx, transfer)
		if err != nil {
			return err
		}
		if transfer.State == model.TransferExpired {
			return ErrTransferExpired
		}
		if transfer.Source != sourceKind || !transfer.SizeKnown || transfer.ContentSHA256 == "" {
			return model.ErrConflict
		}
		if transfer.State == model.TransferCompleted {
			result, err = s.summary(ctx, transfer)
			return err
		}
		if transfer.Terminal() || transfer.State == model.TransferPreparing {
			return model.ErrConflict
		}
		if transfer.Source == model.TransferSourceWebDAV {
			if err := s.connections.AuthorizePublication(ctx, transfer.ConnectionID, transfer.ConnectionRevision); err != nil {
				return err
			}
		}
		if publication != nil {
			if err := publication.authorize(ctx, s.files.clock.Now()); err != nil {
				return err
			}
		}
		info, err := s.stage.Inspect(ctx, id)
		if err != nil {
			return err
		}
		if info.SizeBytes != transfer.SizeBytes || info.OffsetBytes != transfer.SizeBytes {
			return model.ErrConflict
		}
		var mediaType string
		err = s.stage.WithReader(ctx, id, func(source io.ReadSeeker) error {
			hash := sha256.New()
			count, err := io.Copy(hash, io.LimitReader(source, transfer.SizeBytes+1))
			if err != nil {
				return err
			}
			if count != transfer.SizeBytes || hex.EncodeToString(hash.Sum(nil)) != transfer.ContentSHA256 {
				return ErrTransferChecksum
			}
			if _, err := source.Seek(0, io.SeekStart); err != nil {
				return err
			}
			prefix := make([]byte, transferMIMESniffBytes)
			countPrefix, err := io.ReadFull(source, prefix)
			if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
				return err
			}
			mediaType = mime.TypeByExtension(strings.ToLower(path.Ext(transfer.Name)))
			// 替换保留目标名称，但新内容可能改变类型；不能用旧扩展名覆盖可识别的字节类型。
			if transfer.ExpectedEntryID != "" {
				detected := http.DetectContentType(prefix[:countPrefix])
				if detected != "application/octet-stream" || mediaType == "" {
					mediaType = detected
				}
			}
			if mediaType == "" {
				mediaType = http.DetectContentType(prefix[:countPrefix])
			}
			transfer, err = s.repo.ChangeTransfer(ctx, owner, id, "", func(snapshot TransferSnapshot) (model.Transfer, *model.Entry, error) {
				if snapshot.Transfer == nil {
					return model.Transfer{}, nil, model.ErrMissing
				}
				if publication != nil {
					if err := publication.validate(ctx, snapshot, s.files.clock.Now()); err != nil {
						return model.Transfer{}, nil, err
					}
				}
				current := *snapshot.Transfer
				if current.Terminal() {
					return model.Transfer{}, nil, model.ErrConflict
				}
				current.State = model.TransferPublishing
				current.FailureCode = ""
				current.UpdatedAt = s.files.clock.Now().UTC()
				return current, nil, nil
			})
			if err != nil {
				return err
			}
			if publication != nil {
				if err := publication.authorize(ctx, s.files.clock.Now()); err != nil {
					return err
				}
			}
			if err := s.content.PutReader(ctx, transfer.ObjectKey, source, transfer.SizeBytes, mediaType); err != nil {
				return err
			}
			return nil
		})
		if err != nil {
			if publication != nil {
				return err
			}
			code := transferFailureStorage
			if errors.Is(err, ErrTransferChecksum) {
				code = transferFailureChecksum
			}
			return errors.Join(err, s.recordFailure(ctx, owner, id, code, true))
		}
		entryID := transfer.ExpectedEntryID
		if entryID == "" {
			entryID, err = s.files.ids.New()
			if err != nil {
				return err
			}
		}
		if transfer.Source == model.TransferSourceWebDAV {
			if err := s.connections.AuthorizePublication(ctx, transfer.ConnectionID, transfer.ConnectionRevision); err != nil {
				return err
			}
		}
		if publication != nil {
			if err := publication.authorize(ctx, s.files.clock.Now()); err != nil {
				return err
			}
		}
		transfer, err = s.repo.ChangeTransfer(ctx, owner, id, "", func(snapshot TransferSnapshot) (model.Transfer, *model.Entry, error) {
			if snapshot.Transfer == nil {
				return model.Transfer{}, nil, model.ErrMissing
			}
			current := *snapshot.Transfer
			if publication != nil {
				if err := publication.validate(ctx, snapshot, s.files.clock.Now()); err != nil {
					return model.Transfer{}, nil, err
				}
			}
			if current.State == model.TransferCompleted {
				return current, nil, nil
			}
			if current.State != model.TransferPublishing {
				return model.Transfer{}, nil, model.ErrConflict
			}
			if !s.files.clock.Now().Before(current.ExpiresAt) {
				return model.Transfer{}, nil, ErrTransferExpired
			}
			if current.Source == model.TransferSourceWebDAV {
				connection := snapshot.Connection
				if connection == nil || connection.State != model.ConnectionActive || connection.ReadOnly || connection.Revision != current.ConnectionRevision || !s.files.clock.Now().Before(connection.ExpiresAt) || !connectionRoot(snapshot.Entries, connection.RootID) || (connection.RootID != "" && !Within(snapshot.Entries, connection.RootID, current.ParentID)) {
					return model.Transfer{}, nil, ErrConnectionUnavailable
				}
			}
			if err := model.Parent(snapshot.Entries, current.ParentID); err != nil {
				return model.Transfer{}, nil, err
			}
			if err := model.Available(snapshot.Entries, current.ExpectedEntryID, current.ParentID, current.NormalizedName); err != nil {
				return model.Transfer{}, nil, err
			}
			used := model.Used(snapshot.Entries)
			var original *model.Entry
			if current.ExpectedEntryID != "" {
				entry, ok := model.Find(snapshot.Entries, current.ExpectedEntryID)
				if !ok || !model.Visible(snapshot.Entries, entry) || entry.Kind != model.File || entry.ContentRevision != current.ExpectedContentRevision || entry.ParentID != current.ParentID || entry.NormalizedName != current.NormalizedName {
					return model.Transfer{}, nil, model.ErrConflict
				}
				if entry.SizeBytes < 0 || entry.SizeBytes > used {
					return model.Transfer{}, nil, fmt.Errorf("file replacement quota invariant")
				}
				prepared, err := s.files.prepareReplacement(snapshot.Entries, entry, snapshot.HistoryPreferences)
				if err != nil {
					return model.Transfer{}, nil, err
				}
				used = s.files.replacementUsed(snapshot.Entries, entry, prepared)
				original = &prepared
			}
			if used > s.files.policy.QuotaBytes || current.SizeBytes > s.files.policy.QuotaBytes-used {
				return model.Transfer{}, nil, model.ErrQuota
			}
			now := s.files.clock.Now().UTC()
			entry := model.Entry{ID: entryID, OwnerID: owner, ParentID: current.ParentID, Kind: model.File, Name: current.Name, NormalizedName: current.NormalizedName, ObjectKey: current.ObjectKey, SizeBytes: current.SizeBytes, MediaType: mediaType, CreatedAt: now, UpdatedAt: now, ContentSHA: current.ContentSHA256, ContentRevision: 1}
			if original != nil {
				if original.ContentRevision >= model.MaxContentRevision {
					return model.Transfer{}, nil, model.ErrConflict
				}

				entry.CreatedAt = original.CreatedAt
				entry.ContentRevision = original.ContentRevision + 1
				entry.UploadKey = original.UploadKey
				entry.Annotations = model.CloneAnnotations(original.Annotations)
				entry.AnnotationRevision = original.AnnotationRevision
				entry.History = model.CloneHistory(original.History)
				entry.HistoryRevision = original.HistoryRevision
			}
			current.State = model.TransferCompleted
			current.EntryID = entryID
			current.CleanupPending = true
			current.UpdatedAt = now
			current.FailureCode = ""
			return current, &entry, nil
		})
		if err != nil {
			if publication != nil {
				return err
			}
			code := transferFailureDestination
			if errors.Is(err, model.ErrQuota) {
				code = transferFailureQuota
			}
			return errors.Join(err, s.recordFailure(ctx, owner, id, code, true))
		}
		transfer, cleanupErr := s.cleanupLocked(ctx, transfer)
		result, err = s.summary(ctx, transfer)
		// 已发布文件即使清理失败仍保存完成事实；协议边界同时导出明确清理错误供重试。
		return errors.Join(err, cleanupErr)
	})
	return result, err
}
