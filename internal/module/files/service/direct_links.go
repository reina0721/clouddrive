package service

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	DirectLinkBatchLimit = 10
	DirectLinkOwnerLimit = 200
	DirectLinkPageSize   = 20
	directLinkSecret     = "direct-link"
)

type DirectLinkFailure string

const (
	DirectLinkUnavailable DirectLinkFailure = "unavailable"
	DirectLinkLimit       DirectLinkFailure = "limit"
)

type DirectLinkResult struct {
	EntryID string            `json:"entryId"`
	Link    *model.DirectLink `json:"link,omitempty"`
	Failure DirectLinkFailure `json:"failure,omitempty" enum:"unavailable,limit"`
}

type DirectLinkPage struct {
	Items    []model.DirectLink `json:"items"`
	Total    int                `json:"total"`
	Page     int                `json:"page"`
	PageSize int                `json:"pageSize"`
}

type DirectLinkRepository interface {
	IssueDirectLinks(context.Context, string, []model.DirectLink, int) ([]DirectLinkResult, error)
	ListDirectLinks(context.Context, string, int, int) (DirectLinkPage, error)
	RevokeDirectLink(context.Context, string, string) error
	ReadDirectLinkTarget(context.Context, string) (model.DirectLink, error)
}

type DirectLinkAuthority interface {
	AuthorizeShare(context.Context, string, ShareAccountAccess) (bool, error)
}

type DirectLinks struct {
	files     *Service
	links     DirectLinkRepository
	authority DirectLinkAuthority
}

func NewDirectLinks(files *Service, links DirectLinkRepository, authority DirectLinkAuthority) (*DirectLinks, error) {
	if files == nil || links == nil || authority == nil {
		return nil, fmt.Errorf("file direct link dependencies are required")
	}
	return &DirectLinks{files: files, links: links, authority: authority}, nil
}

func (s *DirectLinks) Issue(ctx context.Context, owner string, ids []string) ([]DirectLinkResult, error) {
	if owner == "" || len(ids) < 1 || len(ids) > DirectLinkBatchLimit {
		return nil, model.ErrInvalid
	}
	seen := make(map[string]bool, len(ids))
	for _, id := range ids {
		if model.ValidateTransferID(id) != nil || seen[id] {
			return nil, model.ErrInvalid
		}
		seen[id] = true
	}
	proposed := make([]model.DirectLink, 0, len(ids))
	now := s.files.clock.Now().UTC()
	for _, id := range ids {
		token, err := newCapabilitySecret()
		if err != nil {
			return nil, fmt.Errorf("generate direct link credential: %w", err)
		}
		linkID, err := s.files.ids.New()
		if err != nil {
			return nil, fmt.Errorf("generate direct link identity: %w", err)
		}
		proposed = append(proposed, model.DirectLink{ID: linkID, OwnerID: owner, EntryID: id, Token: token, TokenDigest: credentialDigest(directLinkSecret, token), CreatedAt: now})
	}
	return s.links.IssueDirectLinks(ctx, owner, proposed, s.files.policy.SearchTreeEntries)
}

func (s *DirectLinks) List(ctx context.Context, owner string, page int) (DirectLinkPage, error) {
	if owner == "" || page < 1 || page > DirectLinkOwnerLimit/DirectLinkPageSize {
		return DirectLinkPage{}, model.ErrInvalid
	}
	return s.links.ListDirectLinks(ctx, owner, page, s.files.policy.SearchTreeEntries)
}

func (s *DirectLinks) Revoke(ctx context.Context, owner, id string) error {
	if owner == "" || model.ValidateTransferID(id) != nil {
		return model.ErrMissing
	}
	return s.links.RevokeDirectLink(ctx, owner, id)
}

func (s *DirectLinks) target(ctx context.Context, digest string) (model.DirectLink, error) {
	link, err := s.links.ReadDirectLinkTarget(ctx, digest)
	if err != nil {
		return model.DirectLink{}, err
	}
	allowed, err := s.authority.AuthorizeShare(ctx, link.OwnerID, ShareAccountRead)
	if err != nil {
		return model.DirectLink{}, err
	}
	if !allowed {
		return model.DirectLink{}, model.ErrMissing
	}
	return link, nil
}

// DownloadTo 对每次读取重新验证持有凭据、拥有者权限和源文件可见性。
func (s *DirectLinks) DownloadTo(ctx context.Context, token string, use func(model.Entry, io.ReadSeeker) error) error {
	if !validSecret(token) {
		return model.ErrMissing
	}
	digest := credentialDigest(directLinkSecret, token)
	link, err := s.target(ctx, digest)
	if err != nil {
		return err
	}
	err = s.files.DownloadTo(ctx, link.OwnerID, link.EntryID, func(entry model.Entry, reader io.ReadSeeker) error {
		latest, err := s.target(ctx, digest)
		if err != nil {
			return err
		}
		if latest.ID != link.ID || latest.OwnerID != link.OwnerID || latest.EntryID != link.EntryID {
			return model.ErrMissing
		}
		return use(entry, reader)
	})
	if errors.Is(err, model.ErrConflict) || errors.Is(err, model.ErrInvalid) || errors.Is(err, model.ErrUnsupported) {
		return errors.Join(model.ErrMissing, err)
	}
	return err
}
