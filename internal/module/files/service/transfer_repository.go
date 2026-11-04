package service

import (
	"context"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// TransferPage 返回单个有界页面；NextCursor 为空表示已到本次查询末尾。
type TransferPage struct {
	Items      []model.Transfer
	NextCursor string
}

// TransferRepository 把预留预算、传输状态及最终目录项放在同一个 owner 事务中。
// id 与 key 至多指定一个查询条件；回调返回的 Entry 仅用于首次发布，不能覆盖既有文件。
type TransferRepository interface {
	ReadTransfer(context.Context, string, string) (model.Transfer, error)
	CleanupTransfers(context.Context, time.Time, int) ([]model.Transfer, error)
	ListTransfers(context.Context, string, string, string, int) (TransferPage, error)
	ChangeTransfer(context.Context, string, string, string, func(TransferSnapshot) (model.Transfer, *model.Entry, error)) (model.Transfer, error)
	ChangeShareTransfer(context.Context, string, string, ShareAccess, func(TransferSnapshot) (model.Transfer, *model.Entry, error)) (model.Transfer, error)
}
