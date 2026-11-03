package repo

import (
	"context"
	"gorm.io/gorm"
	"time"
)

// RegistrationSettings 是 IAM 拥有的公开注册策略，版本用于并发控制。
type RegistrationSettings struct {
	ID            int       `json:"-"`
	Enabled       bool      `json:"enabled"`
	DefaultRoleID string    `json:"defaultRoleId"`
	Version       uint64    `json:"version"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func (unit *Unit) Registration(ctx context.Context) (RegistrationSettings, error) {
	var value RegistrationSettings
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table("iam_registration_settings").Where("id = ?", 1).First(&value).Error
	})
	return value, err
}

func (unit *Unit) UpdateRegistration(ctx context.Context, value RegistrationSettings) error {
	return unit.updateVersioned(ctx, "iam_registration_settings", "id = ? AND version = ?", []any{1, value.Version}, map[string]any{"enabled": value.Enabled, "default_role_id": value.DefaultRoleID, "updated_at": value.UpdatedAt, "version": gorm.Expr("version + 1")})
}
