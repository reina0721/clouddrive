package model

import (
	"errors"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"time"
)

// TransferState 表达持久上传状态，不把浏览器临时进度当作完成事实。
type TransferState string

// TransferSource 明确由浏览器tus还是外部同步请求拥有上传源。
type TransferSource string

const (
	TransferSourceTus    TransferSource = "tus"
	TransferSourceWebDAV TransferSource = "webdav"
)

func (s TransferSource) Valid() bool { return s == TransferSourceTus || s == TransferSourceWebDAV }

const (
	TransferPreparing  TransferState = "preparing"
	TransferReceiving  TransferState = "receiving"
	TransferPaused     TransferState = "paused"
	TransferPublishing TransferState = "publishing"
	TransferAttention  TransferState = "attention"
	TransferCompleted  TransferState = "completed"
	TransferCanceled   TransferState = "canceled"
	TransferExpired    TransferState = "expired"
)

// Transfer 是归属于账号的上传及发布记录；暂存和永久对象位置不属于公开 DTO。
type Transfer struct {
	ID                      string
	OwnerID                 string
	ParentID                string
	Name                    string
	NormalizedName          string
	SizeBytes               int64
	SizeKnown               bool
	QuotaReservedBytes      int64
	Source                  TransferSource
	ExpectedEntryID         string
	ExpectedContentRevision int64
	ConnectionID            string
	ConnectionRevision      int64
	ContentSHA256           string
	IdempotencyKey          string
	State                   TransferState
	CreatedAt               time.Time
	UpdatedAt               time.Time
	ExpiresAt               time.Time
	Revision                int64
	EntryID                 string
	ObjectKey               string
	FailureCode             string
	CleanupPending          bool
}

// Terminal 标明无需继续上传；清理失败的 terminal 项仍须保留暂存容量占用。
func (t Transfer) Terminal() bool {
	return t.State == TransferCompleted || t.State == TransferCanceled || t.State == TransferExpired
}

// ReservesBytes 把待清理文件纳入保守预算，不能先释放名额再无限堆积残留。
func (t Transfer) ReservesBytes() bool { return !t.Terminal() || t.CleanupPending }

// Valid 拒绝未知状态，不把拼写错误写进持久化状态机。
func (s TransferState) Valid() bool {
	switch s {
	case TransferPreparing, TransferReceiving, TransferPaused, TransferPublishing, TransferAttention, TransferCompleted, TransferCanceled, TransferExpired:
		return true
	default:
		return false
	}
}

// ValidateTransferID 只允许规范 UUID 作为受控暂存文件名，不接受路径或转义字符。
func ValidateTransferID(id string) error {
	if err := idgen.Validate(id); err != nil {
		return errors.Join(ErrInvalid, err)
	}
	return nil
}
