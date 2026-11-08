package service

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path"
	"slices"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	webPreviewTTL           = 5 * time.Minute
	maxWebPreviewTokenBytes = 2048
)

// WebFilePreviewRequest 确认发起预览时已展示的站点和文件版本。
type WebFilePreviewRequest struct {
	Application     FileApplicationID `json:"application" pattern:"^web-[a-f0-9]{32}$"`
	Origin          string            `json:"origin" maxLength:"512"`
	ContentRevision int64             `json:"contentRevision" minimum:"1"`
}

// WebFilePreview 包含浏览器启动外站所需的短期授权和模板。
type WebFilePreview struct {
	URLTemplate string `json:"urlTemplate"`
	Origin      string `json:"origin"`
	Name        string `json:"name"`
	NewTab      bool   `json:"newTab"`
	Token       string `json:"token"`
}

type webPreviewGrant struct {
	Owner           string
	EntryID         string
	ContentRevision int64
	PolicyRevision  int64
	ExpiresAt       int64
	Origin          string
}

// WebFilePreviews 签发只能读取一个已确认文件版本的短期授权。
type WebFilePreviews struct {
	files        *Service
	applications *FileApplications
	authority    DirectLinkAuthority
	sealer       cipher.AEAD
}

// NewWebFilePreviews 在文件模块装配时创建仅供当前代使用的密钥。
func NewWebFilePreviews(files *Service, applications *FileApplications, authority DirectLinkAuthority) (*WebFilePreviews, error) {
	if files == nil || applications == nil || authority == nil {
		return nil, fmt.Errorf("web preview dependencies are required")
	}
	var key [32]byte
	rand.Read(key[:])
	block, err := aes.NewCipher(key[:])
	clear(key[:])
	if err != nil {
		return nil, fmt.Errorf("initialize web preview cipher: %w", err)
	}
	sealer, err := cipher.NewGCMWithRandomNonce(block)
	if err != nil {
		return nil, fmt.Errorf("initialize web preview sealer: %w", err)
	}
	return &WebFilePreviews{files: files, applications: applications, authority: authority, sealer: sealer}, nil
}

// Launch 校验文件和目标，再签发短期读取能力。
func (s *WebFilePreviews) Launch(ctx context.Context, owner, entryID string, request WebFilePreviewRequest) (WebFilePreview, error) {
	view, err := s.applications.Read(ctx)
	if err != nil {
		return WebFilePreview{}, err
	}
	index := slices.IndexFunc(view.WebApps, func(app WebFileApplication) bool {
		return app.ID == request.Application && app.Enabled
	})
	if index < 0 {
		return WebFilePreview{}, model.ErrMissing
	}
	app := view.WebApps[index]
	detail, err := s.files.Detail(ctx, owner, entryID)
	if err != nil {
		return WebFilePreview{}, err
	}
	entry := detail.Entry
	if request.Origin != app.Origin || request.ContentRevision != entry.ContentRevision {
		return WebFilePreview{}, model.ErrConflict
	}
	if entry.Kind != model.File || !slices.Contains(app.Extensions, strings.TrimPrefix(strings.ToLower(path.Ext(entry.Name)), ".")) {
		return WebFilePreview{}, model.ErrUnsupported
	}
	if app.MaxBytes > 0 && entry.SizeBytes > app.MaxBytes {
		return WebFilePreview{}, model.ErrTooLarge
	}
	grant := webPreviewGrant{
		Owner: owner, EntryID: entry.ID, ContentRevision: entry.ContentRevision,
		PolicyRevision: view.Revision, ExpiresAt: s.files.clock.Now().Add(webPreviewTTL).Unix(), Origin: app.Origin,
	}
	encoded, err := json.Marshal(grant)
	if err != nil {
		return WebFilePreview{}, fmt.Errorf("encode web preview grant: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(s.sealer.Seal(nil, nil, encoded, nil))
	return WebFilePreview{URLTemplate: app.URLTemplate, Origin: app.Origin, Name: entry.Name, NewTab: app.NewTab, Token: token}, nil
}

// DownloadTo 验证授权并在现有文件读取租约内传输该版本。
func (s *WebFilePreviews) DownloadTo(ctx context.Context, token string, use func(model.Entry, io.ReadSeeker, string) error) error {
	if len(token) > maxWebPreviewTokenBytes {
		return model.ErrMissing
	}
	sealed, err := base64.RawURLEncoding.Strict().DecodeString(token)
	if err != nil {
		return model.ErrMissing
	}
	encoded, err := s.sealer.Open(nil, nil, sealed, nil)
	if err != nil {
		return model.ErrMissing
	}
	var grant webPreviewGrant
	if err := json.Unmarshal(encoded, &grant); err != nil {
		return fmt.Errorf("decode authenticated web preview grant: %w", err)
	}
	if grant.ExpiresAt <= s.files.clock.Now().Unix() {
		return model.ErrMissing
	}
	allowed, err := s.authority.AuthorizeShare(ctx, grant.Owner, ShareAccountRead)
	if err != nil {
		return err
	}
	if !allowed {
		return model.ErrMissing
	}
	err = s.files.DownloadTo(ctx, grant.Owner, grant.EntryID, func(entry model.Entry, reader io.ReadSeeker) error {
		view, err := s.applications.Read(ctx)
		if err != nil {
			return err
		}
		if grant.PolicyRevision != view.Revision || grant.ContentRevision != entry.ContentRevision || grant.ExpiresAt <= s.files.clock.Now().Unix() {
			return model.ErrMissing
		}
		return use(entry, reader, grant.Origin)
	})
	if errors.Is(err, model.ErrConflict) || errors.Is(err, model.ErrInvalid) || errors.Is(err, model.ErrUnsupported) {
		return errors.Join(model.ErrMissing, err)
	}
	return err
}
