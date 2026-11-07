package model

import "time"

// DirectLink 绑定本人一个文件，保存可重复取得的随机凭据。
type DirectLink struct {
	ID          string    `json:"id"`
	OwnerID     string    `json:"-"`
	EntryID     string    `json:"entryId"`
	Token       string    `json:"token"`
	TokenDigest string    `json:"-"`
	CreatedAt   time.Time `json:"createdAt"`
	Name        string    `json:"name"`
	Active      bool      `json:"active"`
}
