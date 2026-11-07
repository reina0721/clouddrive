package service

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type WorkspacePagination string

const (
	PaginationNumbered WorkspacePagination = "numbered"
	PaginationCursor   WorkspacePagination = "cursor"
)

func (p WorkspacePagination) valid() bool {
	return p == PaginationNumbered || p == PaginationCursor
}

type WorkspaceQueryPagination string

const (
	WorkspacePaginationAuto     WorkspaceQueryPagination = "auto"
	WorkspacePaginationNumbered WorkspaceQueryPagination = "numbered"
	maxWorkspaceCursorLength                             = 120
)

type FileCursorPage struct {
	Previous string `json:"previous,omitempty"`
	Next     string `json:"next,omitempty"`
}

func (s *Service) prepareWorkspacePagination(owner string, input Query, q *Query) error {
	if input.Pagination == "" && input.Cursor == "" {
		return nil
	}
	if (input.Pagination != WorkspacePaginationAuto && input.Pagination != WorkspacePaginationNumbered) ||
		input.PageSize == 0 || len(input.Cursor) > maxWorkspaceCursorLength {
		return model.ErrInvalid
	}
	q.PageSize = min(q.PageSize, s.policy.WorkspaceMaxPageSize)
	cursorMode := input.Pagination == WorkspacePaginationAuto &&
		(s.policy.WorkspacePagination == PaginationCursor || input.hasWorkspaceSearch() || input.Cursor != "")
	if cursorMode {
		if input.Page > 1 {
			return model.ErrInvalid
		}
		q.cursorOwner = owner
	} else if input.Cursor != "" {
		return model.ErrInvalid
	}
	return nil
}

func (q Query) hasWorkspaceSearch() bool {
	return q.Search != "" || q.Category != "" || len(q.Keywords) > 0 || len(q.Kinds) > 0 ||
		len(q.Extensions) > 0 || len(q.Tags) > 0 || q.Property != nil ||
		q.Scope != "" || q.MinBytes != nil || q.MaxBytes != nil ||
		q.CreatedFrom != nil || q.CreatedTo != nil || q.ModifiedFrom != nil || q.ModifiedTo != nil
}

type cursorDirection string

const (
	cursorPrevious cursorDirection = "p"
	cursorNext     cursorDirection = "n"
)

// cursorAnchor 只绑定参与排序的字段。更新不相关的元数据不会使锚点失效。
type cursorAnchor struct {
	Folder bool
	Name   string
	Bytes  int64
	Time   time.Time
}

func cursorToken(q Query, direction cursorDirection, entry model.Entry) (string, error) {
	q.Cursor, q.Page = "", 0
	anchor := cursorAnchor{Folder: q.FoldersFirst && entry.Kind == model.Folder}
	switch q.Sort {
	case SortSize:
		anchor.Bytes = entry.SizeBytes
	case SortCreated:
		anchor.Time = entry.CreatedAt.UTC()
	case SortUpdated:
		anchor.Time = entry.UpdatedAt.UTC()
	default:
		anchor.Name = entry.NormalizedName
	}
	payload, err := json.Marshal(struct {
		Owner     string
		Query     Query
		Direction cursorDirection
		EntryID   string
		Anchor    cursorAnchor
	}{q.cursorOwner, q, direction, entry.ID, anchor})
	if err != nil {
		return "", fmt.Errorf("encode file cursor scope: %w", err)
	}
	digest := sha256.Sum256(payload)
	return string(direction) + "." + base64.RawURLEncoding.EncodeToString([]byte(entry.ID)) +
		"." + base64.RawURLEncoding.EncodeToString(digest[:]), nil
}

// applyCursor 在当前已授权并排序的快照内定位锚点。新增在锚点之前的条目不会挤动下一批。
func (l *Listing) applyCursor(q Query) error {
	start, end := 0, min(q.PageSize, l.Total)
	if q.Cursor != "" {
		directionText, tail, hasDirection := strings.Cut(q.Cursor, ".")
		encodedID, digest, hasDigest := strings.Cut(tail, ".")
		direction := cursorDirection(directionText)
		id, idErr := base64.RawURLEncoding.DecodeString(encodedID)
		if !hasDirection || !hasDigest || (direction != cursorNext && direction != cursorPrevious) ||
			idErr != nil || len(id) == 0 || len(digest) != base64.RawURLEncoding.EncodedLen(sha256.Size) {
			return model.ErrInvalid
		}
		index := -1
		for i := range l.Items {
			if l.Items[i].ID == string(id) {
				index = i
				break
			}
		}
		if index < 0 {
			return model.ErrConflict
		}
		expected, err := cursorToken(q, direction, l.Items[index])
		if err != nil {
			return err
		}
		if expected != q.Cursor {
			return model.ErrConflict
		}
		if direction == cursorNext {
			start = index + 1
			end = min(start+q.PageSize, l.Total)
		} else {
			end = index
			start = max(0, end-q.PageSize)
		}
		if start == end {
			return model.ErrConflict
		}
	}
	page := &FileCursorPage{}
	if start > 0 {
		token, err := cursorToken(q, cursorPrevious, l.Items[start])
		if err != nil {
			return err
		}
		page.Previous = token
	}
	if end < l.Total {
		token, err := cursorToken(q, cursorNext, l.Items[end-1])
		if err != nil {
			return err
		}
		page.Next = token
	}
	l.Page, l.PageSize, l.CursorPage = 1, q.PageSize, page
	l.Items = l.Items[start:end]
	return nil
}
