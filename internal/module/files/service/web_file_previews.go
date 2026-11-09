package service

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	webPreviewTTL           = 5 * time.Minute
	maxWebPreviewTokenBytes = 2048
)

// ErrWOPIAccessToken 表示无效、过期或用途不符的 WOPI 访问令牌。
var ErrWOPIAccessToken = errors.New("invalid WOPI access token")

// WebFilePreviewRequest 确认发起预览时已展示的站点和文件版本。
type WebFilePreviewRequest struct {
	Application     FileApplicationID `json:"application" pattern:"^web-[a-f0-9]{32}$"`
	Origin          string            `json:"origin" maxLength:"512"`
	ContentRevision int64             `json:"contentRevision" minimum:"1"`
}

// WebFilePreview 包含浏览器启动外站所需的短期授权和模板。
type WebFilePreview struct {
	URLTemplate string             `json:"urlTemplate"`
	Origin      string             `json:"origin"`
	Name        string             `json:"name"`
	NewTab      bool               `json:"newTab"`
	Token       string             `json:"token"`
	WOPI        *WOPIPreviewLaunch `json:"wopi,omitempty"`
}

// WOPIPreviewLaunch 描述一次通过表单 POST 启动的只读会话。
type WOPIPreviewLaunch struct {
	ActionURL             string `json:"actionUrl"`
	ExpiresAtMilliseconds int64  `json:"expiresAtMilliseconds"`
}

type webPreviewGrant struct {
	Owner           string
	EntryID         string
	ContentRevision int64
	PolicyRevision  int64
	ExpiresAt       int64
	Origin          string
	Protocol        FilePreviewProtocol
}

// WOPIFileInfo 按协议公布最小只读文件属性。
type WOPIFileInfo struct {
	BaseFileName            string `json:"BaseFileName"`
	Size                    int64  `json:"Size"`
	Version                 string `json:"Version"`
	OwnerID                 string `json:"OwnerId"`
	UserID                  string `json:"UserId"`
	UserFriendlyName        string `json:"UserFriendlyName"`
	ReadOnly                bool   `json:"ReadOnly"`
	UserCanWrite            bool   `json:"UserCanWrite"`
	SupportsLocks           bool   `json:"SupportsLocks"`
	SupportsUpdate          bool   `json:"SupportsUpdate"`
	UserCanNotWriteRelative bool   `json:"UserCanNotWriteRelative"`
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
	extension := strings.TrimPrefix(strings.ToLower(path.Ext(entry.Name)), ".")
	if entry.Kind != model.File || !slices.Contains(app.Extensions, extension) {
		return WebFilePreview{}, model.ErrUnsupported
	}
	if app.MaxBytes > 0 && entry.SizeBytes > app.MaxBytes {
		return WebFilePreview{}, model.ErrTooLarge
	}
	expires := s.files.clock.Now().Add(webPreviewTTL).Truncate(time.Second)
	grant := webPreviewGrant{
		Owner: owner, EntryID: entry.ID, ContentRevision: entry.ContentRevision,
		PolicyRevision: view.Revision, ExpiresAt: expires.Unix(), Origin: app.Origin, Protocol: app.Protocol,
	}
	encoded, err := json.Marshal(grant)
	if err != nil {
		return WebFilePreview{}, fmt.Errorf("encode web preview grant: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(s.sealer.Seal(nil, nil, encoded, nil))
	result := WebFilePreview{URLTemplate: app.URLTemplate, Origin: app.Origin, Name: entry.Name, NewTab: app.NewTab, Token: token}
	if app.Protocol == FilePreviewWOPI {
		action := slices.IndexFunc(app.WOPI.Actions, func(action WOPIViewAction) bool { return action.Extension == extension })
		if action < 0 {
			return WebFilePreview{}, model.ErrUnsupported
		}
		result.WOPI = &WOPIPreviewLaunch{ActionURL: app.WOPI.Actions[action].URL, ExpiresAtMilliseconds: expires.UnixMilli()}
	}
	return result, nil
}

func (s *WebFilePreviews) readGrant(ctx context.Context, token string, protocol FilePreviewProtocol, entryID string) (webPreviewGrant, error) {
	invalid := model.ErrMissing
	if protocol == FilePreviewWOPI {
		invalid = ErrWOPIAccessToken
	}
	if len(token) > maxWebPreviewTokenBytes {
		return webPreviewGrant{}, invalid
	}
	sealed, err := base64.RawURLEncoding.Strict().DecodeString(token)
	if err != nil {
		return webPreviewGrant{}, invalid
	}
	encoded, err := s.sealer.Open(nil, nil, sealed, nil)
	if err != nil {
		return webPreviewGrant{}, invalid
	}
	var grant webPreviewGrant
	if err := json.Unmarshal(encoded, &grant); err != nil {
		return webPreviewGrant{}, fmt.Errorf("decode authenticated web preview grant: %w", err)
	}
	if grant.ExpiresAt <= s.files.clock.Now().Unix() || grant.Protocol != protocol {
		return webPreviewGrant{}, invalid
	}
	if protocol == FilePreviewWOPI && grant.EntryID != entryID {
		return webPreviewGrant{}, model.ErrMissing
	}
	allowed, err := s.authority.AuthorizeShare(ctx, grant.Owner, ShareAccountRead)
	if err != nil {
		return webPreviewGrant{}, err
	}
	if !allowed {
		return webPreviewGrant{}, model.ErrMissing
	}
	return grant, nil
}

func (s *WebFilePreviews) verifyGrantVersion(ctx context.Context, grant webPreviewGrant, entry model.Entry) error {
	view, err := s.applications.Read(ctx)
	if err != nil {
		return err
	}
	if entry.Kind != model.File || grant.PolicyRevision != view.Revision || grant.ContentRevision != entry.ContentRevision ||
		grant.ExpiresAt <= s.files.clock.Now().Unix() {
		return model.ErrMissing
	}
	return nil
}

// InspectWOPI 返回经本次授权确认的文件版本和只读标记。
func (s *WebFilePreviews) InspectWOPI(ctx context.Context, token, entryID string) (WOPIFileInfo, error) {
	grant, err := s.readGrant(ctx, token, FilePreviewWOPI, entryID)
	if err != nil {
		return WOPIFileInfo{}, err
	}
	detail, err := s.files.Detail(ctx, grant.Owner, grant.EntryID)
	if err != nil {
		return WOPIFileInfo{}, err
	}
	entry := detail.Entry
	if err := s.verifyGrantVersion(ctx, grant, entry); err != nil {
		return WOPIFileInfo{}, err
	}
	digest := sha256.Sum256([]byte("wopi-owner:" + grant.Owner))
	user := base64.RawURLEncoding.EncodeToString(digest[:])
	return WOPIFileInfo{
		BaseFileName: entry.Name, Size: entry.SizeBytes, Version: strconv.FormatInt(entry.ContentRevision, 10),
		OwnerID: user, UserID: user, UserFriendlyName: "Viewer", ReadOnly: true, UserCanNotWriteRelative: true,
	}, nil
}

// DownloadWOPITo 读取与 WOPI 文件标识绑定的已确认版本。
func (s *WebFilePreviews) DownloadWOPITo(ctx context.Context, token, entryID string, use func(model.Entry, io.ReadSeeker) error) error {
	grant, err := s.readGrant(ctx, token, FilePreviewWOPI, entryID)
	if err != nil {
		return err
	}
	return s.downloadGrant(ctx, grant, use)
}

// DownloadTo 验证网页授权并在现有文件读取租约内传输该版本。
func (s *WebFilePreviews) DownloadTo(ctx context.Context, token string, use func(model.Entry, io.ReadSeeker, string) error) error {
	grant, err := s.readGrant(ctx, token, "", "")
	if err != nil {
		return err
	}
	return s.downloadGrant(ctx, grant, func(entry model.Entry, reader io.ReadSeeker) error {
		return use(entry, reader, grant.Origin)
	})
}

func (s *WebFilePreviews) downloadGrant(ctx context.Context, grant webPreviewGrant, use func(model.Entry, io.ReadSeeker) error) error {
	err := s.files.DownloadTo(ctx, grant.Owner, grant.EntryID, func(entry model.Entry, reader io.ReadSeeker) error {
		if err := s.verifyGrantVersion(ctx, grant, entry); err != nil {
			return err
		}
		return use(entry, reader)
	})
	if errors.Is(err, model.ErrConflict) || errors.Is(err, model.ErrInvalid) || errors.Is(err, model.ErrUnsupported) {
		return errors.Join(model.ErrMissing, err)
	}
	return err
}
