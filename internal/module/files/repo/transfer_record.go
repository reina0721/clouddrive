package repo

import (
	"encoding/json"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"io"
	"strings"
	"time"
)

// transferRecord 是持久化边界，结构化条件不通过业务类型的ORM标签保存。
type transferRecord struct {
	DAVConditionDocument    string
	ShareAudienceSubject    string
	ShareID                 string
	ShareRevision           int64
	ShareGrantDigest        string
	DownloadID              string
	ID                      string
	OwnerID                 string
	ParentID                string
	Name                    string
	NormalizedName          string
	SizeBytes               int64
	SizeKnown               bool
	QuotaReservedBytes      int64
	Source                  model.TransferSource
	ExpectedEntryID         string
	ExpectedContentRevision int64
	ConnectionID            string
	ConnectionRevision      int64
	ContentSHA256           string
	IdempotencyKey          string
	State                   model.TransferState
	CreatedAt               time.Time
	UpdatedAt               time.Time
	ExpiresAt               time.Time
	Revision                int64
	EntryID                 string
	ObjectKey               string
	FailureCode             string
	CleanupPending          bool
}

func (transferRecord) TableName() string { return "files_transfers" }

func (r transferRecord) model() (model.Transfer, error) {
	value := model.Transfer{ShareAudienceSubject: r.ShareAudienceSubject, ShareID: r.ShareID, ShareRevision: r.ShareRevision, ShareGrantDigest: r.ShareGrantDigest, DownloadID: r.DownloadID, ID: r.ID, OwnerID: r.OwnerID, ParentID: r.ParentID, Name: r.Name, NormalizedName: r.NormalizedName, SizeBytes: r.SizeBytes, SizeKnown: r.SizeKnown, QuotaReservedBytes: r.QuotaReservedBytes, Source: r.Source, ExpectedEntryID: r.ExpectedEntryID, ExpectedContentRevision: r.ExpectedContentRevision, ConnectionID: r.ConnectionID, ConnectionRevision: r.ConnectionRevision, ContentSHA256: r.ContentSHA256, IdempotencyKey: r.IdempotencyKey, State: r.State, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt, ExpiresAt: r.ExpiresAt, Revision: r.Revision, EntryID: r.EntryID, ObjectKey: r.ObjectKey, FailureCode: r.FailureCode, CleanupPending: r.CleanupPending}
	if len(r.DAVConditionDocument) > model.MaxDAVConditionBytes {
		return model.Transfer{}, model.ErrTooLarge
	}
	if r.DAVConditionDocument != "" {
		decoder := json.NewDecoder(strings.NewReader(r.DAVConditionDocument))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&value.DAVCondition); err != nil {
			return model.Transfer{}, fmt.Errorf("decode transfer DAV condition: %w", err)
		}
		var trailing json.RawMessage
		if err := decoder.Decode(&trailing); err != io.EOF {
			if err != nil {
				return model.Transfer{}, fmt.Errorf("decode trailing transfer DAV condition: %w", err)
			}
			return model.Transfer{}, model.ErrInvalid
		}
	}
	if err := value.DAVCondition.Validate(); err != nil {
		return model.Transfer{}, err
	}
	if value.Source != model.TransferSourceWebDAV && len(value.DAVCondition.Lists) != 0 {
		return model.Transfer{}, model.ErrInvalid
	}
	return value, nil
}

func transferRecordFromModel(t model.Transfer) (transferRecord, error) {
	if err := t.DAVCondition.Validate(); err != nil {
		return transferRecord{}, err
	}
	if t.Source != model.TransferSourceWebDAV && len(t.DAVCondition.Lists) != 0 {
		return transferRecord{}, model.ErrInvalid
	}
	r := transferRecord{ShareAudienceSubject: t.ShareAudienceSubject, ShareID: t.ShareID, ShareRevision: t.ShareRevision, ShareGrantDigest: t.ShareGrantDigest, DownloadID: t.DownloadID, ID: t.ID, OwnerID: t.OwnerID, ParentID: t.ParentID, Name: t.Name, NormalizedName: t.NormalizedName, SizeBytes: t.SizeBytes, SizeKnown: t.SizeKnown, QuotaReservedBytes: t.QuotaReservedBytes, Source: t.Source, ExpectedEntryID: t.ExpectedEntryID, ExpectedContentRevision: t.ExpectedContentRevision, ConnectionID: t.ConnectionID, ConnectionRevision: t.ConnectionRevision, ContentSHA256: t.ContentSHA256, IdempotencyKey: t.IdempotencyKey, State: t.State, CreatedAt: t.CreatedAt, UpdatedAt: t.UpdatedAt, ExpiresAt: t.ExpiresAt, Revision: t.Revision, EntryID: t.EntryID, ObjectKey: t.ObjectKey, FailureCode: t.FailureCode, CleanupPending: t.CleanupPending}
	if len(t.DAVCondition.Lists) > 0 {
		encoded, err := json.Marshal(t.DAVCondition)
		if err != nil {
			return transferRecord{}, fmt.Errorf("encode transfer DAV condition: %w", err)
		}
		if len(encoded) > model.MaxDAVConditionBytes {
			return transferRecord{}, model.ErrTooLarge
		}
		r.DAVConditionDocument = string(encoded)
	}
	return r, nil
}
