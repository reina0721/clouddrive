package repo

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"io"
	"strings"
	"time"
)

// strictAccessJSON 拒绝超额、未知字段与尾部内容，不把损坏持久数据解释为默认授权。
func strictAccessJSON(value string, target any) error {
	if len(value) > model.MaxAccessPolicyJSONBytes {
		return model.ErrTooLarge
	}
	decoder := json.NewDecoder(strings.NewReader(value))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("decode access policy: %w", err)
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err != nil {
			return fmt.Errorf("decode access policy tail: %w", err)
		}
		return fmt.Errorf("unexpected access policy tail")
	}
	return nil
}

func encodeAudience(value model.AudiencePolicy) (string, error) {
	if err := value.Validate(); err != nil {
		return "", err
	}
	encoded, err := json.Marshal(model.CloneAudience(value))
	if err != nil {
		return "", fmt.Errorf("encode share audience: %w", err)
	}
	if len(encoded) > model.MaxAccessPolicyJSONBytes {
		return "", model.ErrTooLarge
	}
	return string(encoded), nil
}

func decodeAudience(value string) (model.AudiencePolicy, error) {
	var result model.AudiencePolicy
	if strings.TrimSpace(value) == "null" {
		return result, model.ErrInvalid
	}
	if err := strictAccessJSON(value, &result); err != nil {
		return result, err
	}
	if err := result.Validate(); err != nil {
		return result, err
	}
	return result, nil
}

func encodeAccessPolicy(value *model.AccessPolicy) (string, error) {
	if value != nil {
		if err := value.Validate(); err != nil {
			return "", err
		}
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return "", fmt.Errorf("encode file access policy: %w", err)
	}
	if len(encoded) > model.MaxAccessPolicyJSONBytes {
		return "", model.ErrTooLarge
	}
	return string(encoded), nil
}

func decodeAccessPolicy(value string) (*model.AccessPolicy, error) {
	var result *model.AccessPolicy
	if err := strictAccessJSON(value, &result); err != nil {
		return nil, err
	}
	if result != nil {
		if err := result.Validate(); err != nil {
			return nil, err
		}
	}
	return result, nil
}

// shareRecord 显式拥有ORM列，受众的JSON编码不进入业务Model。
type shareRecord struct {
	Title                                             string
	State                                             model.ShareState
	Permissions                                       model.SharePermission
	Revision                                          int64
	ID                                                string `gorm:"primaryKey"`
	OwnerID, RootID, Token, TokenDigest, PasswordHash string
	CreatedAt, ExpiresAt                              time.Time
	RevokedAt, AttemptWindow                          *time.Time
	UnlockAttempts                                    int
	AudienceJSON                                      string
}

func shareRecordFromModel(share model.Share) (shareRecord, error) {
	audience, err := encodeAudience(share.Audience)
	if err != nil {
		return shareRecord{}, err
	}
	return shareRecord{Title: share.Title, State: share.State, Permissions: share.Permissions, Revision: share.Revision, ID: share.ID, OwnerID: share.OwnerID, RootID: share.RootID, Token: share.Token, TokenDigest: share.TokenDigest, PasswordHash: share.PasswordHash, CreatedAt: share.CreatedAt, ExpiresAt: share.ExpiresAt, RevokedAt: share.RevokedAt, AttemptWindow: share.AttemptWindow, UnlockAttempts: share.UnlockAttempts, AudienceJSON: audience}, nil
}

func (record shareRecord) model() (model.Share, error) {
	audience, err := decodeAudience(record.AudienceJSON)
	if err != nil {
		return model.Share{}, err
	}
	return model.Share{Audience: audience, Title: record.Title, State: record.State, Permissions: record.Permissions, Revision: record.Revision, ID: record.ID, OwnerID: record.OwnerID, RootID: record.RootID, Token: record.Token, TokenDigest: record.TokenDigest, PasswordHash: record.PasswordHash, CreatedAt: record.CreatedAt, ExpiresAt: record.ExpiresAt, RevokedAt: record.RevokedAt, AttemptWindow: record.AttemptWindow, UnlockAttempts: record.UnlockAttempts}, nil
}
