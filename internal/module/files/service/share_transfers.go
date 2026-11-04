package service

import (
	"context"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// ShareTransfers 只向访客投影自己的分享绑定，内部统一使用原Transfer生命周期与发布。
const maxSharedTransferClientKeyBytes = 64

type ShareTransfers struct {
	sharing   *Sharing
	transfers *Transfers
}

func NewShareTransfers(sharing *Sharing, transfers *Transfers) (*ShareTransfers, error) {
	if sharing == nil || transfers == nil {
		return nil, model.ErrInvalid
	}
	return &ShareTransfers{sharing: sharing, transfers: transfers}, nil
}

type SharedTransferCreate struct {
	ParentID  string `json:"parentId" maxLength:"36"`
	Name      string `json:"name" minLength:"1" maxLength:"255"`
	SizeBytes int64  `json:"sizeBytes" minimum:"0" maximum:"536870912"`
	SHA256    string `json:"sha256" minLength:"64" maxLength:"64"`
	ClientKey string `json:"clientKey" minLength:"16" maxLength:"64"`
}
type SharedTransfer struct {
	ID             string              `json:"id"`
	Name           string              `json:"name"`
	SizeBytes      int64               `json:"sizeBytes"`
	OffsetBytes    int64               `json:"offsetBytes"`
	State          model.TransferState `json:"state"`
	EntryID        string              `json:"entryId"`
	ChunkBytes     int64               `json:"chunkBytes"`
	ExpiresAt      time.Time           `json:"expiresAt"`
	CleanupPending bool                `json:"cleanupPending"`
}

func (s *ShareTransfers) summary(value TransferSummary) SharedTransfer {
	return SharedTransfer{ID: value.ID, Name: value.Name, SizeBytes: value.SizeBytes, OffsetBytes: value.OffsetBytes, State: value.State, EntryID: value.EntryID, ChunkBytes: s.transfers.ChunkBytes(), ExpiresAt: value.ExpiresAt, CleanupPending: value.CleanupPending}
}
func (s *ShareTransfers) Create(ctx context.Context, token, ticket string, input SharedTransferCreate) (SharedTransfer, error) {
	if len(input.ClientKey) > maxSharedTransferClientKeyBytes {
		return SharedTransfer{}, model.ErrInvalid
	}
	_, access, owner, err := s.sharing.scope(ctx, token, ticket, ShareActionUpload, SharedSelection{Destination: &input.ParentID})
	if err != nil {
		return SharedTransfer{}, err
	}
	publication := &sharePublication{sharing: s.sharing, owner: owner, access: access}
	value, err := s.transfers.createAuthorized(ctx, owner, TransferRequest{ParentID: *access.Destination, Name: input.Name, SizeBytes: input.SizeBytes, SHA256: input.SHA256, Key: "share:" + access.ShareID + ":" + input.ClientKey}, publication)
	if err != nil {
		return SharedTransfer{}, err
	}
	return s.summary(value), nil
}
func (s *ShareTransfers) publication(ctx context.Context, token, ticket, id string) (*sharePublication, model.Transfer, error) {
	_, access, owner, err := s.sharing.scope(ctx, token, ticket, ShareActionUpload, SharedSelection{})
	if err != nil {
		return nil, model.Transfer{}, err
	}
	transfer, err := s.transfers.repo.ReadTransfer(ctx, owner, id)
	if err != nil {
		return nil, transfer, err
	}
	if transfer.Source != model.TransferSourceShare || transfer.ShareID != access.ShareID || transfer.ShareRevision != access.ShareRevision || transfer.ShareGrantDigest != access.GrantDigest {
		return nil, transfer, model.ErrMissing
	}
	access.Destination = &transfer.ParentID
	publication := &sharePublication{sharing: s.sharing, owner: owner, access: access}
	if err := publication.authorize(ctx, s.sharing.files.clock.Now()); err != nil {
		return nil, transfer, err
	}
	return publication, transfer, nil
}
func (s *ShareTransfers) Read(ctx context.Context, token, ticket, id string) (SharedTransfer, error) {
	_, transfer, err := s.publication(ctx, token, ticket, id)
	if err != nil {
		return SharedTransfer{}, err
	}
	value, err := s.transfers.readSource(ctx, transfer.OwnerID, id, model.TransferSourceShare)
	if err != nil {
		return SharedTransfer{}, err
	}
	return s.summary(value), nil
}
func (s *ShareTransfers) RunReceiving(ctx context.Context, token, ticket, id string, use func(context.Context) error) error {
	publication, transfer, err := s.publication(ctx, token, ticket, id)
	if err != nil {
		return err
	}
	return s.transfers.runReceivingSource(ctx, transfer.OwnerID, id, model.TransferSourceShare, func(ctx context.Context) error {
		if err := publication.authorize(ctx, s.sharing.files.clock.Now()); err != nil {
			return err
		}
		return use(ctx)
	})
}
func (s *ShareTransfers) Commit(ctx context.Context, token, ticket, id string) (SharedTransfer, error) {
	publication, transfer, err := s.publication(ctx, token, ticket, id)
	if err != nil {
		return SharedTransfer{}, err
	}
	value, err := s.transfers.commitAuthorized(ctx, transfer.OwnerID, id, model.TransferSourceShare, publication)
	if err != nil {
		return SharedTransfer{}, err
	}
	return s.summary(value), nil
}

// Cancel 允许原上传凭据在策略失效后清理本候选，不能借此发布内容或删除已保存文件。
func (s *ShareTransfers) Cancel(ctx context.Context, token, ticket, id string) (SharedTransfer, error) {
	if !validSecret(token) {
		return SharedTransfer{}, model.ErrMissing
	}
	grant := ""
	if ticket != "" {
		if !validSecret(ticket) {
			return SharedTransfer{}, model.ErrShareLocked
		}
		grant = credentialDigest("grant", ticket)
	}
	share, err := s.sharing.shared.ReadShareBinding(ctx, credentialDigest("share", token))
	if err != nil {
		return SharedTransfer{}, err
	}
	transfer, err := s.transfers.repo.ReadTransfer(ctx, share.OwnerID, id)
	if err != nil {
		return SharedTransfer{}, err
	}
	if transfer.Source != model.TransferSourceShare || transfer.ShareID != share.ID || transfer.ShareGrantDigest != grant {
		return SharedTransfer{}, model.ErrMissing
	}
	if transfer.State == model.TransferCompleted {
		value, err := s.transfers.summary(ctx, transfer)
		if err != nil {
			return SharedTransfer{}, err
		}
		return s.summary(value), nil
	}
	value, err := s.transfers.cancelSource(ctx, transfer.OwnerID, id, model.TransferSourceShare)
	if err != nil {
		return SharedTransfer{}, err
	}
	return s.summary(value), nil
}
