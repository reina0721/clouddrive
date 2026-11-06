package model

import "errors"

var ErrShareForbidden = errors.New("file share permission denied")

// ShareState 区分可恢复暂停与永久撤销；撤销事实仍由RevokedAt单独保留。
type ShareState string

const (
	ShareEnabled ShareState = "active"
	SharePaused  ShareState = "paused"
)

// SharePermission 是分享内的有限文件能力集合；账号状态与角色事实仍由IAM拥有。
type SharePermission uint16

const (
	ShareBrowse SharePermission = 1 << iota
	SharePreview
	ShareDownload
	ShareCreate
	ShareUpload
	ShareModify
	ShareRename
	ShareMove
	ShareCopy
	ShareTrash
)

const (
	ShareReadOnly   = ShareBrowse | SharePreview | ShareDownload
	ShareUploadOnly = ShareCreate | ShareUpload
	ShareEditor     = ShareReadOnly | ShareUploadOnly | ShareModify | ShareRename | ShareMove | ShareCopy | ShareTrash
)

func (p SharePermission) Allows(required SharePermission) bool { return p&required == required }
func (p SharePermission) Valid() bool {
	if p == 0 || p & ^ShareEditor != 0 {
		return false
	}
	if p.Allows(ShareModify) && !p.Allows(SharePreview) {
		return false
	}
	return p&(ShareRename|ShareMove|ShareCopy|ShareTrash) == 0 || p.Allows(ShareBrowse)
}
