package model

import "time"

const MaxTrashRetentionDays = 365
const trashRetentionDay = 24 * time.Hour

// TrashRetention 保存本人的回收规则。0 天表示手动清理。
type TrashRetention struct {
	Days     int   `json:"days" minimum:"0" maximum:"365"`
	Revision int64 `json:"revision" minimum:"0" maximum:"9007199254740991"`
}

func (p TrashRetention) Validate() error {
	if p.Days < 0 || p.Days > MaxTrashRetentionDays || p.Revision < 0 || p.Revision > MaxPreferenceRevision {
		return ErrInvalid
	}
	return nil
}

func (p TrashRetention) Expiry(trashedAt time.Time) *time.Time {
	if p.Days == 0 {
		return nil
	}
	expires := trashedAt.UTC().Add(time.Duration(p.Days) * trashRetentionDay)
	return &expires
}

// TrashExpiryCandidate 标识一次可重试的回收转换。
type TrashExpiryCandidate struct {
	ID             string
	OwnerID        string
	TrashedAt      time.Time
	TrashExpiresAt time.Time
	TrashRetryAt   time.Time
}

func (c TrashExpiryCandidate) Matches(entry Entry) bool {
	return entry.ID == c.ID && entry.OwnerID == c.OwnerID &&
		entry.TrashedAt != nil && entry.TrashedAt.Equal(c.TrashedAt) &&
		entry.TrashExpiresAt != nil && entry.TrashExpiresAt.Equal(c.TrashExpiresAt) &&
		entry.TrashRetryAt != nil && entry.TrashRetryAt.Equal(c.TrashRetryAt)
}

func ValidateTrashDeadline(trashed, expires, retry *time.Time) error {
	if expires == nil && retry == nil {
		return nil
	}
	if trashed == nil || expires == nil || retry == nil || !expires.After(*trashed) || retry.Before(*expires) {
		return ErrInvalid
	}
	return nil
}
