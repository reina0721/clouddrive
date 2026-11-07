package service

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	BackgroundTaskPageSize    = 20
	BackgroundTaskMaxRecords  = ArchiveTaskOwnerLimit + model.MaxDownloadOwnerRecords
	backgroundTaskSearchRunes = 120
)

type BackgroundTaskKind string

const (
	BackgroundTaskAny        BackgroundTaskKind = "all"
	BackgroundTaskZIP        BackgroundTaskKind = BackgroundTaskKind(ArchiveTaskZIP)
	BackgroundTaskExtract    BackgroundTaskKind = BackgroundTaskKind(ArchiveTaskExtract)
	BackgroundTaskHTTP       BackgroundTaskKind = BackgroundTaskKind(model.DownloadHTTP)
	BackgroundTaskBitTorrent BackgroundTaskKind = BackgroundTaskKind(model.DownloadBitTorrent)
)

type BackgroundTaskStatus string

const (
	BackgroundStatusAll       BackgroundTaskStatus = "all"
	BackgroundStatusActive    BackgroundTaskStatus = "active"
	BackgroundStatusCompleted BackgroundTaskStatus = BackgroundTaskStatus(model.DownloadCompleted)
	BackgroundStatusFailed    BackgroundTaskStatus = BackgroundTaskStatus(model.DownloadFailed)
	BackgroundStatusCanceled  BackgroundTaskStatus = BackgroundTaskStatus(model.DownloadCanceled)
	BackgroundStatusExpired   BackgroundTaskStatus = BackgroundTaskStatus(model.DownloadExpired)
)

// BackgroundTask 是本人归档和下载的公共读取视图，不持有任务输入或节点配置。
type BackgroundTask struct {
	ID                 string             `json:"id"`
	Kind               BackgroundTaskKind `json:"kind" enum:"zip,extract,http,bittorrent"`
	SourceName         string             `json:"sourceName"`
	State              string             `json:"state"`
	FailureCode        string             `json:"failureCode"`
	CreatedAt          time.Time          `json:"createdAt"`
	UpdatedAt          time.Time          `json:"updatedAt"`
	DeclaredBytes      *int64             `json:"declaredBytes"`
	ReceivedBytes      int64              `json:"receivedBytes"`
	RateBytesPerSecond float64            `json:"rateBytesPerSecond"`
	SourceStatus       int                `json:"sourceStatus"`
	DestinationID      string             `json:"destinationId"`
	ResultEntryID      string             `json:"resultEntryId"`
	CreatedCount       int                `json:"createdCount"`
	SkippedCount       int                `json:"skippedCount"`
	RenamedCount       int                `json:"renamedCount"`
	CleanupPending     bool               `json:"cleanupPending"`
}

type BackgroundTaskQuery struct {
	Kind   BackgroundTaskKind
	Status BackgroundTaskStatus
	Search string
	Page   int
}

type BackgroundTaskListing struct {
	Items            []BackgroundTask `json:"items"`
	ArchiveAvailable bool             `json:"archiveAvailable"`
	Total            int              `json:"total"`
	UnfilteredTotal  int              `json:"unfilteredTotal"`
	Page             int              `json:"page"`
	PageSize         int              `json:"pageSize"`
}

type BackgroundTaskRepository interface {
	ListBackgroundTasks(context.Context, string) ([]BackgroundTask, error)
}

type BackgroundTasks struct {
	repository BackgroundTaskRepository
	archives   *ArchiveTasks
}

func NewBackgroundTasks(repository BackgroundTaskRepository, archives *ArchiveTasks) (*BackgroundTasks, error) {
	if repository == nil || archives == nil {
		return nil, fmt.Errorf("background task reader dependencies incomplete")
	}
	return &BackgroundTasks{repository: repository, archives: archives}, nil
}

func (s *BackgroundTasks) List(ctx context.Context, owner string, query BackgroundTaskQuery) (BackgroundTaskListing, error) {
	switch query.Kind {
	case BackgroundTaskAny, BackgroundTaskZIP, BackgroundTaskExtract, BackgroundTaskHTTP, BackgroundTaskBitTorrent:
	default:
		return BackgroundTaskListing{}, model.ErrInvalid
	}
	switch query.Status {
	case BackgroundStatusAll, BackgroundStatusActive, BackgroundStatusCompleted, BackgroundStatusFailed, BackgroundStatusCanceled, BackgroundStatusExpired:
	default:
		return BackgroundTaskListing{}, model.ErrInvalid
	}
	if owner == "" || query.Page < 1 || !utf8.ValidString(query.Search) || utf8.RuneCountInString(query.Search) > backgroundTaskSearchRunes {
		return BackgroundTaskListing{}, model.ErrInvalid
	}
	records, err := s.repository.ListBackgroundTasks(ctx, owner)
	if err != nil {
		return BackgroundTaskListing{}, err
	}
	if len(records) > BackgroundTaskMaxRecords {
		return BackgroundTaskListing{}, model.ErrTooLarge
	}
	needle := strings.ToLower(strings.TrimSpace(query.Search))
	matches := make([]BackgroundTask, 0, len(records))
	seen := make(map[struct {
		kind BackgroundTaskKind
		id   string
	}]bool, len(records))
	for _, task := range records {
		if err := ctx.Err(); err != nil {
			return BackgroundTaskListing{}, err
		}
		key := struct {
			kind BackgroundTaskKind
			id   string
		}{task.Kind, task.ID}
		if seen[key] {
			return BackgroundTaskListing{}, fmt.Errorf("background task projection identity invariant")
		}
		seen[key] = true
		status, err := backgroundStatus(task)
		if err != nil {
			return BackgroundTaskListing{}, err
		}
		if (query.Kind == BackgroundTaskAny || query.Kind == task.Kind) &&
			(query.Status == BackgroundStatusAll || query.Status == status) &&
			strings.Contains(strings.ToLower(task.SourceName), needle) {
			matches = append(matches, task)
		}
	}
	sort.Slice(matches, func(i, j int) bool {
		left, right := matches[i], matches[j]
		if !left.CreatedAt.Equal(right.CreatedAt) {
			return left.CreatedAt.After(right.CreatedAt)
		}
		if left.ID != right.ID {
			return left.ID > right.ID
		}
		return left.Kind < right.Kind
	})
	lastPage := max(1, (len(matches)+BackgroundTaskPageSize-1)/BackgroundTaskPageSize)
	page := min(query.Page, lastPage)
	start := (page - 1) * BackgroundTaskPageSize
	end := min(start+BackgroundTaskPageSize, len(matches))
	return BackgroundTaskListing{
		Items: matches[start:end], ArchiveAvailable: s.archives.available, Total: len(matches),
		UnfilteredTotal: len(records), Page: page, PageSize: BackgroundTaskPageSize,
	}, nil
}

func backgroundStatus(task BackgroundTask) (BackgroundTaskStatus, error) {
	switch task.Kind {
	case BackgroundTaskZIP, BackgroundTaskExtract:
		switch ArchiveTaskState(task.State) {
		case ArchiveTaskCompleted:
			return BackgroundStatusCompleted, nil
		case ArchiveTaskFailed:
			return BackgroundStatusFailed, nil
		case ArchiveTaskCanceled:
			return BackgroundStatusCanceled, nil
		case ArchiveTaskQueued, ArchiveTaskRunning, ArchiveTaskPublishing:
			return BackgroundStatusActive, nil
		}
	case BackgroundTaskHTTP, BackgroundTaskBitTorrent:
		state := model.DownloadState(task.State)
		if state.Valid() {
			if state.Finished() {
				return BackgroundTaskStatus(state), nil
			}
			return BackgroundStatusActive, nil
		}
	}
	return "", fmt.Errorf("background task state invariant")
}
