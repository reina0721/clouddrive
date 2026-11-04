package service

import "github.com/reina0721/clouddrive/internal/module/files/model"

// SharePermissions 以客户可读的具名能力表示链接策略，存储使用受控位集。
type SharePermissions struct {
	Browse   bool `json:"browse"`
	Preview  bool `json:"preview"`
	Download bool `json:"download"`
	Create   bool `json:"create"`
	Upload   bool `json:"upload"`
	Modify   bool `json:"modify"`
	Rename   bool `json:"rename"`
	Move     bool `json:"move"`
	Copy     bool `json:"copy"`
	Delete   bool `json:"delete"`
}

func sharePermissions(set model.SharePermission) SharePermissions {
	return SharePermissions{Browse: set.Allows(model.ShareBrowse), Preview: set.Allows(model.SharePreview), Download: set.Allows(model.ShareDownload), Create: set.Allows(model.ShareCreate), Upload: set.Allows(model.ShareUpload), Modify: set.Allows(model.ShareModify), Rename: set.Allows(model.ShareRename), Move: set.Allows(model.ShareMove), Copy: set.Allows(model.ShareCopy), Delete: set.Allows(model.ShareTrash)}
}
func (p SharePermissions) permissionSet() model.SharePermission {
	var result model.SharePermission
	for _, capability := range []struct {
		enabled    bool
		permission model.SharePermission
	}{{p.Browse, model.ShareBrowse}, {p.Preview, model.SharePreview}, {p.Download, model.ShareDownload}, {p.Create, model.ShareCreate}, {p.Upload, model.ShareUpload}, {p.Modify, model.ShareModify}, {p.Rename, model.ShareRename}, {p.Move, model.ShareMove}, {p.Copy, model.ShareCopy}, {p.Delete, model.ShareTrash}} {
		if capability.enabled {
			result |= capability.permission
		}
	}
	return result
}
