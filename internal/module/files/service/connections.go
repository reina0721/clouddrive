package service

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

const maxConnectionNameRunes = 128
const connectionCredentialDomain = "webdav-connection"

var (
	ErrConnectionCredentials = errors.New("file connection credentials invalid")
	ErrConnectionUnavailable = errors.New("file connection unavailable")
	ErrConnectionReadOnly    = errors.New("file connection is read only")
)

type ConnectionStatus string

const (
	ConnectionStatusActive      ConnectionStatus = "active"
	ConnectionStatusDisabled    ConnectionStatus = "disabled"
	ConnectionStatusRevoked     ConnectionStatus = "revoked"
	ConnectionStatusExpired     ConnectionStatus = "expired"
	ConnectionStatusUnavailable ConnectionStatus = "unavailable"
)

type ConnectionSummary struct {
	ID               string           `json:"id"`
	Name             string           `json:"name"`
	RootID           string           `json:"rootId"`
	RootPath         string           `json:"rootPath"`
	ReadOnly         bool             `json:"readOnly"`
	BlockSystemFiles bool             `json:"blockSystemFiles"`
	Status           ConnectionStatus `json:"status"`
	ExpiresAt        time.Time        `json:"expiresAt"`
	CreatedAt        time.Time        `json:"createdAt"`
	Revision         int64            `json:"revision"`
}
type ConnectionIssued struct {
	ConnectionSummary
	Password string `json:"password"`
}
type ConnectionListing struct {
	Items             []ConnectionSummary `json:"items"`
	NextCursor        string              `json:"nextCursor"`
	Limit             int                 `json:"limit"`
	DefaultAgeSeconds int64               `json:"defaultAgeSeconds"`
	MaxAgeSeconds     int64               `json:"maxAgeSeconds"`
	MetadataLimited   bool                `json:"metadataLimited"`
}
type ConnectionRequest struct {
	Name             string     `json:"name"`
	RootID           string     `json:"rootId"`
	ReadOnly         bool       `json:"readOnly"`
	BlockSystemFiles bool       `json:"blockSystemFiles"`
	ExpiresAt        *time.Time `json:"expiresAt,omitempty"`
}
type ConnectionChange struct {
	Revision         int64   `json:"revision" minimum:"1"`
	Name             *string `json:"name,omitempty"`
	ReadOnly         *bool   `json:"readOnly,omitempty"`
	BlockSystemFiles *bool   `json:"blockSystemFiles,omitempty"`
}

// Connections 拥有独立高熵凭据及scope，IAM只提供当前账号权限判断。
type Connections struct {
	files     *Service
	store     ConnectionRepository
	authority ConnectionAuthorizer
	policy    ConnectionPolicy
}

func NewConnections(files *Service, store ConnectionRepository, authority ConnectionAuthorizer, policy ConnectionPolicy) (*Connections, error) {
	if files == nil || store == nil || authority == nil {
		return nil, fmt.Errorf("file connection dependencies incomplete")
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	return &Connections{files: files, store: store, authority: authority, policy: policy}, nil
}
func (s *Connections) Policy() ConnectionPolicy { return s.policy }

// AuthorizePublication 在写永久对象前和提交前复核连接及IAM当前权限。
func (s *Connections) AuthorizePublication(ctx context.Context, id string, revision int64) error {
	_, _, err := s.Check(ctx, id, revision, ConnectionWrite)
	return err
}

func connectionName(value string) (string, error) {
	value = strings.TrimSpace(value)
	if !utf8.ValidString(value) || value == "" || utf8.RuneCountInString(value) > maxConnectionNameRunes || strings.IndexFunc(value, unicode.IsControl) >= 0 {
		return "", model.ErrInvalid
	}
	return value, nil
}
func connectionRoot(entries []model.Entry, root string) bool {
	if root == "" {
		return entries != nil
	}
	entry, ok := model.Find(entries, root)
	return ok && entry.Kind == model.Folder && model.Visible(entries, entry)
}
func (s *Connections) status(connection model.Connection, entries []model.Entry) ConnectionStatus {
	if connection.State == model.ConnectionRevoked {
		return ConnectionStatusRevoked
	}
	if !s.files.clock.Now().Before(connection.ExpiresAt) {
		return ConnectionStatusExpired
	}
	if connection.State == model.ConnectionDisabled {
		return ConnectionStatusDisabled
	}
	if !connectionRoot(entries, connection.RootID) {
		return ConnectionStatusUnavailable
	}
	if connection.State != model.ConnectionActive {
		return ConnectionStatusUnavailable
	}
	return ConnectionStatusActive
}
func (s *Connections) summary(connection model.Connection, entries []model.Entry) (ConnectionSummary, error) {
	status := s.status(connection, entries)
	rootPath := "/"
	if connection.RootID != "" && connectionRoot(entries, connection.RootID) {
		parts := []string{}
		pathLimited := false
		id := connection.RootID
		for depth := 0; id != ""; depth++ {
			if depth >= s.policy.PathDepth {
				pathLimited = true
				break
			}
			entry, ok := model.Find(entries, id)
			if !ok {
				return ConnectionSummary{}, model.ErrMissing
			}
			parts = append(parts, entry.Name)
			id = entry.ParentID
		}
		for left, right := 0, len(parts)-1; left < right; left, right = left+1, right-1 {
			parts[left], parts[right] = parts[right], parts[left]
		}
		rootPath = "/" + strings.Join(parts, "/")
		if pathLimited {
			rootPath = ""
		}
	}
	if status == ConnectionStatusUnavailable || (connection.RootID != "" && !connectionRoot(entries, connection.RootID)) {
		rootPath = ""
	}
	return ConnectionSummary{ID: connection.ID, Name: connection.Name, RootID: connection.RootID, RootPath: rootPath, ReadOnly: connection.ReadOnly, BlockSystemFiles: connection.BlockSystemFiles, Status: status, ExpiresAt: connection.ExpiresAt, CreatedAt: connection.CreatedAt, Revision: connection.Revision}, nil
}

func (s *Connections) Create(ctx context.Context, owner string, input ConnectionRequest) (ConnectionIssued, error) {
	if owner == "" {
		return ConnectionIssued{}, model.ErrMissing
	}
	name, err := connectionName(input.Name)
	if err != nil {
		return ConnectionIssued{}, err
	}
	now := s.files.clock.Now().UTC()
	expiry := now.Add(s.policy.DefaultAge)
	if input.ExpiresAt != nil {
		expiry = input.ExpiresAt.UTC()
	}
	if !expiry.After(now) || expiry.After(now.Add(s.policy.MaxAge)) {
		return ConnectionIssued{}, model.ErrInvalid
	}
	secret, err := newCapabilitySecret()
	if err != nil {
		return ConnectionIssued{}, err
	}
	id, err := s.files.ids.New()
	if err != nil {
		return ConnectionIssued{}, err
	}
	var summary ConnectionSummary
	changed, err := s.store.ChangeConnection(ctx, owner, "", func(snapshot ConnectionSnapshot) (model.Connection, error) {
		if snapshot.EntriesUnavailable {
			return model.Connection{}, model.ErrTooLarge
		}
		if snapshot.ActiveCount >= int64(s.policy.Limit) {
			return model.Connection{}, model.ErrBusy
		}
		if !connectionRoot(snapshot.Entries, input.RootID) {
			return model.Connection{}, model.ErrMissing
		}
		connection := model.Connection{ID: id, OwnerID: owner, Name: name, RootID: input.RootID, ReadOnly: input.ReadOnly, BlockSystemFiles: input.BlockSystemFiles, SecretDigest: credentialDigest(connectionCredentialDomain, secret), State: model.ConnectionActive, ExpiresAt: expiry, CreatedAt: now, UpdatedAt: now}
		var err error
		summary, err = s.summary(connection, snapshot.Entries)
		return connection, err
	})
	if err != nil {
		return ConnectionIssued{}, err
	}
	summary.Revision = changed.Revision
	return ConnectionIssued{ConnectionSummary: summary, Password: secret}, nil
}
func (s *Connections) List(ctx context.Context, owner, cursor string, limit int) (ConnectionListing, error) {
	if owner == "" {
		return ConnectionListing{}, model.ErrMissing
	}
	page, err := s.store.ListConnections(ctx, owner, cursor, limit)
	if err != nil {
		return ConnectionListing{}, err
	}
	entries, err := s.store.ConnectionEntries(ctx, owner)
	if err != nil && !errors.Is(err, model.ErrTooLarge) {
		return ConnectionListing{}, err
	}
	result := ConnectionListing{Items: []ConnectionSummary{}, NextCursor: page.NextCursor, Limit: s.policy.Limit, DefaultAgeSeconds: int64(s.policy.DefaultAge / time.Second), MaxAgeSeconds: int64(s.policy.MaxAge / time.Second), MetadataLimited: errors.Is(err, model.ErrTooLarge)}
	for _, connection := range page.Items {
		item, err := s.summary(connection, entries)
		if err != nil {
			return ConnectionListing{}, err
		}
		result.Items = append(result.Items, item)
	}
	return result, nil
}

// Read 只向连接所有者返回当前策略，不返回凭据摘要。
func (s *Connections) Read(ctx context.Context, owner, id string) (ConnectionSummary, error) {
	connection, err := s.store.ReadConnection(ctx, id)
	if err != nil {
		return ConnectionSummary{}, err
	}
	if owner == "" || connection.OwnerID != owner {
		return ConnectionSummary{}, model.ErrMissing
	}
	entries, err := s.store.ConnectionEntries(ctx, owner)
	if err != nil && !errors.Is(err, model.ErrTooLarge) {
		return ConnectionSummary{}, err
	}
	return s.summary(connection, entries)
}
func (s *Connections) mutate(ctx context.Context, owner, id string, revision int64, change func(*model.Connection) error) (ConnectionSummary, error) {
	if revision < 1 {
		return ConnectionSummary{}, model.ErrInvalid
	}
	var summary ConnectionSummary
	changed, err := s.store.ChangeConnection(ctx, owner, id, func(snapshot ConnectionSnapshot) (model.Connection, error) {
		if snapshot.Current == nil {
			return model.Connection{}, model.ErrMissing
		}
		current := *snapshot.Current
		if current.Revision != revision {
			return model.Connection{}, model.ErrConflict
		}
		if err := change(&current); err != nil {
			return model.Connection{}, err
		}
		current.UpdatedAt = s.files.clock.Now().UTC()
		var err error
		summary, err = s.summary(current, snapshot.Entries)
		return current, err
	})
	if err != nil {
		return ConnectionSummary{}, err
	}
	summary.Revision = changed.Revision
	return summary, nil
}
func (s *Connections) Update(ctx context.Context, owner, id string, input ConnectionChange) (ConnectionSummary, error) {
	if input.Name == nil && input.ReadOnly == nil && input.BlockSystemFiles == nil {
		return ConnectionSummary{}, model.ErrInvalid
	}
	return s.mutate(ctx, owner, id, input.Revision, func(current *model.Connection) error {
		if current.State == model.ConnectionRevoked {
			return model.ErrConflict
		}
		if input.Name != nil {
			name, err := connectionName(*input.Name)
			if err != nil {
				return err
			}
			current.Name = name
		}
		if input.ReadOnly != nil {
			current.ReadOnly = *input.ReadOnly
		}
		if input.BlockSystemFiles != nil {
			current.BlockSystemFiles = *input.BlockSystemFiles
		}
		return nil
	})
}
func (s *Connections) SetState(ctx context.Context, owner, id string, revision int64, state model.ConnectionState) (ConnectionSummary, error) {
	if !state.Valid() {
		return ConnectionSummary{}, model.ErrInvalid
	}
	return s.mutate(ctx, owner, id, revision, func(current *model.Connection) error {
		if current.State == model.ConnectionRevoked && state != model.ConnectionRevoked {
			return model.ErrConflict
		}
		current.State = state
		return nil
	})
}
func (s *Connections) Rotate(ctx context.Context, owner, id string, revision int64) (ConnectionIssued, error) {
	secret, err := newCapabilitySecret()
	if err != nil {
		return ConnectionIssued{}, err
	}
	summary, err := s.mutate(ctx, owner, id, revision, func(current *model.Connection) error {
		if current.State == model.ConnectionRevoked || !s.files.clock.Now().Before(current.ExpiresAt) {
			return model.ErrConflict
		}
		current.SecretDigest = credentialDigest(connectionCredentialDomain, secret)
		return nil
	})
	if err != nil {
		return ConnectionIssued{}, err
	}
	return ConnectionIssued{ConnectionSummary: summary, Password: secret}, nil
}

// Check 每次重新读取连接及账号权限，revision非零时同时拒绝正在进行操作的旧策略。
func (s *Connections) Check(ctx context.Context, id string, revision int64, access ConnectionAccess) (model.Connection, []model.Entry, error) {
	if access != ConnectionRead && access != ConnectionWrite {
		return model.Connection{}, nil, model.ErrInvalid
	}
	connection, err := s.store.ReadConnection(ctx, id)
	if err != nil {
		return model.Connection{}, nil, err
	}
	entries, err := s.store.ConnectionEntries(ctx, connection.OwnerID)
	if err != nil {
		return model.Connection{}, nil, err
	}
	if s.status(connection, entries) != ConnectionStatusActive || (revision != 0 && revision != connection.Revision) {
		return model.Connection{}, nil, ErrConnectionUnavailable
	}
	if access == ConnectionWrite && connection.ReadOnly {
		return model.Connection{}, nil, ErrConnectionReadOnly
	}
	allowed, err := s.authority.AuthorizeConnection(ctx, connection.OwnerID, ConnectionRead)
	if err != nil {
		return model.Connection{}, nil, err
	}
	if !allowed {
		return model.Connection{}, nil, ErrConnectionUnavailable
	}
	if access == ConnectionWrite {
		allowed, err = s.authority.AuthorizeConnection(ctx, connection.OwnerID, ConnectionWrite)
		if err != nil {
			return model.Connection{}, nil, err
		}
		if !allowed {
			return model.Connection{}, nil, ErrConnectionUnavailable
		}
	}
	return connection, entries, nil
}
func (s *Connections) Authenticate(ctx context.Context, id, username, password string) (model.Connection, error) {
	if idgen.Validate(id) != nil || username != id || !validSecret(password) {
		return model.Connection{}, ErrConnectionCredentials
	}
	connection, err := s.store.ReadConnection(ctx, id)
	if err != nil {
		if errors.Is(err, model.ErrMissing) {
			return model.Connection{}, errors.Join(ErrConnectionCredentials, err)
		}
		return model.Connection{}, err
	}
	candidate := credentialDigest(connectionCredentialDomain, password)
	if subtle.ConstantTimeCompare([]byte(candidate), []byte(connection.SecretDigest)) != 1 {
		return model.Connection{}, ErrConnectionCredentials
	}
	current, _, err := s.Check(ctx, id, connection.Revision, ConnectionRead)
	if errors.Is(err, ErrConnectionUnavailable) {
		return model.Connection{}, errors.Join(ErrConnectionCredentials, err)
	}
	return current, err
}
