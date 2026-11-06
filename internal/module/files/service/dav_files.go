package service

import (
	"context"
	"io"
	"strings"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// DAVScope 保存认证连接与协议条件，每次业务调用重新核对当前事实。
type DAVScope struct {
	Condition    model.DAVCondition
	ConnectionID string
	Revision     int64
}
type DAVItem struct {
	Entry model.Entry
	Path  string
}

// DAVFiles 把相对路径解析和原子业务操作与第三方协议类型隔离。
type DAVFiles struct {
	files       *Service
	connections *Connections
	transfers   *Transfers
	locks       *WriteLocks
}

func NewDAVFiles(files *Service, connections *Connections, transfers *Transfers, locks *WriteLocks) (*DAVFiles, error) {
	if files == nil || connections == nil || transfers == nil || locks == nil {
		return nil, model.ErrInvalid
	}
	return &DAVFiles{files: files, connections: connections, transfers: transfers, locks: locks}, nil
}

func (s *DAVFiles) WriteLocks() *WriteLocks { return s.locks }

func (s *Connections) parts(relative string) ([]string, error) {
	p := s.policy
	if !utf8.ValidString(relative) || len(relative) > p.PathBytes || !strings.HasPrefix(relative, "/") || strings.ContainsAny(relative, "\\\x00") {
		return nil, model.ErrInvalid
	}
	if relative == "/" {
		return nil, nil
	}
	relative = strings.TrimSuffix(relative, "/")
	parts := strings.Split(strings.TrimPrefix(relative, "/"), "/")
	if len(parts) > p.PathDepth {
		return nil, model.ErrTooLarge
	}
	for _, part := range parts {
		if part == "" || part == "." || part == ".." {
			return nil, model.ErrInvalid
		}
		if _, err := s.files.normalizedName(part); err != nil {
			return nil, err
		}
	}
	return parts, nil
}
func (s *Connections) resolve(entries []model.Entry, connection model.Connection, parts []string) (model.Entry, error) {
	current := model.Entry{ID: connection.RootID, OwnerID: connection.OwnerID, Kind: model.Folder}
	if connection.RootID != "" {
		var ok bool
		current, ok = model.Find(entries, connection.RootID)
		if !ok || !model.Visible(entries, current) || current.Kind != model.Folder {
			return model.Entry{}, model.ErrMissing
		}
	}
	for _, component := range parts {
		if current.Kind != model.Folder {
			return model.Entry{}, model.ErrMissing
		}
		normalized, err := s.files.normalizedName(component)
		if err != nil {
			return model.Entry{}, err
		}
		var next *model.Entry
		for _, entry := range entries {
			if entry.ParentID == current.ID && entry.NormalizedName == normalized && model.Visible(entries, entry) {
				if next != nil {
					return model.Entry{}, model.ErrConflict
				}
				copy := entry
				next = &copy
			}
		}
		if next == nil {
			return model.Entry{}, model.ErrMissing
		}
		current = *next
	}
	return current, nil
}
func (s *DAVFiles) snapshot(ctx context.Context, scope DAVScope, access ConnectionAccess) (model.Connection, []model.Entry, error) {
	return s.connections.Check(ctx, scope.ConnectionID, scope.Revision, access)
}

func (s *DAVFiles) Stat(ctx context.Context, scope DAVScope, relative string) (DAVItem, error) {
	parts, err := s.connections.parts(relative)
	if err != nil {
		return DAVItem{}, err
	}
	connection, entries, err := s.snapshot(ctx, scope, ConnectionRead)
	if err != nil {
		return DAVItem{}, err
	}
	entry, err := s.connections.resolve(entries, connection, parts)
	if err != nil {
		return DAVItem{}, err
	}
	return DAVItem{Entry: entry, Path: "/" + strings.Join(parts, "/")}, nil
}

// ReadDir 包含目录本身，匹配成熟协议库的Depth查询契约；超限不返回截断目录。
func (s *DAVFiles) ReadDir(ctx context.Context, scope DAVScope, relative string, recursive bool) ([]DAVItem, error) {
	parts, err := s.connections.parts(relative)
	if err != nil {
		return nil, err
	}
	connection, entries, err := s.snapshot(ctx, scope, ConnectionRead)
	if err != nil {
		return nil, err
	}
	root, err := s.connections.resolve(entries, connection, parts)
	if err != nil {
		return nil, err
	}
	if root.Kind != model.Folder {
		return nil, model.ErrInvalid
	}
	rootPath := "/" + strings.Join(parts, "/")
	items := []DAVItem{{Entry: root, Path: rootPath}}
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if entry.ID == root.ID || !model.Visible(entries, entry) {
			continue
		}
		included := entry.ParentID == root.ID
		if recursive {
			included = root.ID == "" || Within(entries, root.ID, entry.ID)
		}
		if !included {
			continue
		}
		suffix := []string{entry.Name}
		parent := entry.ParentID
		for depth := 0; parent != root.ID; depth++ {
			if depth >= s.connections.policy.PathDepth {
				return nil, model.ErrTooLarge
			}
			ancestor, ok := model.Find(entries, parent)
			if !ok {
				return nil, model.ErrMissing
			}
			suffix = append(suffix, ancestor.Name)
			parent = ancestor.ParentID
		}
		for left, right := 0, len(suffix)-1; left < right; left, right = left+1, right-1 {
			suffix[left], suffix[right] = suffix[right], suffix[left]
		}
		childPath := strings.TrimSuffix(rootPath, "/") + "/" + strings.Join(suffix, "/")
		if len(parts)+len(suffix) > s.connections.policy.PathDepth || len(childPath) > s.connections.policy.PathBytes {
			return nil, model.ErrTooLarge
		}
		items = append(items, DAVItem{Entry: entry, Path: childPath})
		if len(items) > s.connections.policy.DirectoryEntries {
			return nil, model.ErrTooLarge
		}
	}
	return items, nil
}

func (s *DAVFiles) DownloadTo(ctx context.Context, scope DAVScope, relative string, use func(DAVItem, io.ReadSeeker) error) error {
	if use == nil {
		return model.ErrInvalid
	}
	parts, err := s.connections.parts(relative)
	if err != nil {
		return err
	}
	connection, entries, err := s.snapshot(ctx, scope, ConnectionRead)
	if err != nil {
		return err
	}
	entry, err := s.connections.resolve(entries, connection, parts)
	if err != nil {
		return err
	}
	if entry.Kind != model.File {
		if entry.Kind == model.Shortcut {
			return model.ErrUnsupported
		}
		return model.ErrInvalid
	}
	return s.files.DownloadTo(ctx, connection.OwnerID, entry.ID, func(current model.Entry, source io.ReadSeeker) error {
		latestConnection, latestEntries, err := s.snapshot(ctx, scope, ConnectionRead)
		if err != nil {
			return err
		}
		latest, err := s.connections.resolve(latestEntries, latestConnection, parts)
		if err != nil {
			return err
		}
		if latest.ID != current.ID || latest.ObjectKey != current.ObjectKey {
			return model.ErrConflict
		}
		return use(DAVItem{Entry: current, Path: "/" + strings.Join(parts, "/")}, source)
	})
}

func (s *DAVFiles) Put(ctx context.Context, scope DAVScope, relative string, length int64, condition ContentCondition, source io.Reader) (DAVItem, bool, error) {
	condition.DAV = scope.Condition
	parts, err := s.connections.parts(relative)
	if err != nil {
		return DAVItem{}, false, err
	}
	if len(parts) == 0 {
		return DAVItem{}, false, model.ErrConflict
	}
	connection, entries, err := s.snapshot(ctx, scope, ConnectionWrite)
	if err != nil {
		return DAVItem{}, false, err
	}
	parent, err := s.connections.resolve(entries, connection, parts[:len(parts)-1])
	if err != nil {
		return DAVItem{}, false, err
	}
	if parent.Kind != model.Folder {
		return DAVItem{}, false, model.ErrConflict
	}
	entry, created, err := s.transfers.Ingest(ctx, connection, parent.ID, parts[len(parts)-1], length, condition, source)
	return DAVItem{Entry: entry, Path: "/" + strings.Join(parts, "/")}, created, err
}
