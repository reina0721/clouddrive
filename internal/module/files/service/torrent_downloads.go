package service

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"path"
	"strings"
	"sync"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/logger"
)

const (
	TorrentDispatchTaskID = "files.bittorrent.dispatch"
	TorrentBase64Limit    = (MaxTorrentMetadataBytes + 2) / 3 * 4
	torrentSourceOrigin   = "bittorrent"
	torrentUploadPrefix   = "torrent:"
	torrentTransferPrefix = "bt:"
)

// TorrentNode 显式配对本代配置和窄引擎；后台用例不自行查找客户端。
type TorrentNode struct {
	Config TorrentNodeConfig
	Engine TorrentEngine
}

// TorrentDownloads 拥有逻辑任务，外部引擎只拥有受控块暂存。
type TorrentDownloads struct {
	transfers         *Transfers
	repo              TorrentRepository
	decoder           TorrentMetadataDecoder
	accounts          DownloadAccountAuthority
	policy            DownloadPolicy
	nodes             map[string]TorrentNode
	available         bool
	dispatcherEnabled bool
	logger            logger.Logger
	activeMu          sync.Mutex
	active            map[string]downloadRun
}

func NewTorrentDownloads(transfers *Transfers, repository TorrentRepository, decoder TorrentMetadataDecoder, accounts DownloadAccountAuthority, policy DownloadPolicy, dispatcherEnabled bool, nodes []TorrentNode, logging logger.Logger) (*TorrentDownloads, error) {
	if transfers == nil || repository == nil || decoder == nil || accounts == nil || logging == nil {
		return nil, fmt.Errorf("torrent dependencies incomplete")
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	if len(nodes) != len(policy.TorrentNodes) {
		return nil, fmt.Errorf("torrent node assembly incomplete")
	}
	configured := map[string]TorrentNodeConfig{}
	for _, node := range policy.TorrentNodes {
		configured[node.ID] = node
	}
	owned := map[string]TorrentNode{}
	for _, node := range nodes {
		expected, exists := configured[node.Config.ID]
		if !exists || expected != node.Config || node.Engine == nil {
			return nil, fmt.Errorf("torrent node assembly mismatch")
		}
		if _, duplicate := owned[node.Config.ID]; duplicate {
			return nil, model.ErrInvalid
		}
		owned[node.Config.ID] = node
	}
	return &TorrentDownloads{transfers: transfers, repo: repository, decoder: decoder, accounts: accounts, policy: policy, nodes: owned, available: policy.Enabled && dispatcherEnabled && len(owned) > 0, dispatcherEnabled: dispatcherEnabled, logger: logging, active: map[string]downloadRun{}}, nil
}

type TorrentCreate struct {
	URI           string `json:"uri,omitempty" maxLength:"4096"`
	TorrentBase64 string `json:"torrentBase64,omitempty" maxLength:"1398104"`
	NodeID        string `json:"nodeId" minLength:"1" maxLength:"64"`
	ParentID      string `json:"parentId" maxLength:"36"`
	Name          string `json:"name" maxLength:"255"`
	ClientKey     string `json:"clientKey" minLength:"16" maxLength:"64"`
}

type TorrentNodeSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type TorrentCapabilities struct {
	Available        bool                 `json:"available"`
	Nodes            []TorrentNodeSummary `json:"nodes"`
	MaxMetadataBytes int                  `json:"maxMetadataBytes"`
	MaxFiles         int                  `json:"maxFiles"`
}

func (s *TorrentDownloads) Capabilities() TorrentCapabilities {
	result := TorrentCapabilities{Available: s.available, Nodes: []TorrentNodeSummary{}, MaxMetadataBytes: MaxTorrentMetadataBytes, MaxFiles: MaxTorrentFiles}
	for _, configured := range s.policy.TorrentNodes {
		result.Nodes = append(result.Nodes, TorrentNodeSummary{ID: configured.ID, Name: configured.Name})
	}
	return result
}

func (s *TorrentDownloads) authorize(ctx context.Context, owner string) error {
	allowed, err := s.accounts.AuthorizeDownload(ctx, owner)
	if err != nil {
		return errors.Join(model.ErrDownloadPermission, err)
	}
	if !allowed {
		return model.ErrDownloadPermission
	}
	return nil
}

func (s *TorrentDownloads) Create(ctx context.Context, owner string, input TorrentCreate) (DownloadSummary, error) {
	if !s.available {
		return DownloadSummary{}, model.ErrDownloadUnavailable
	}
	if _, exists := s.nodes[input.NodeID]; !exists {
		return DownloadSummary{}, ErrTorrentNode
	}
	if err := s.authorize(ctx, owner); err != nil {
		return DownloadSummary{}, err
	}
	if (input.URI == "") == (input.TorrentBase64 == "") {
		return DownloadSummary{}, model.ErrInvalid
	}
	identifier, err := s.transfers.files.ids.New()
	if err != nil {
		return DownloadSummary{}, err
	}
	data := TorrentData{TaskID: identifier, NodeID: input.NodeID, Files: []TorrentSelectionFile{}, Folders: []TorrentFolder{}}
	var source string
	state := model.DownloadQueued
	if input.URI != "" {
		source, data.InfoHash, err = s.decoder.NormalizeMagnet(input.URI)
		if err != nil {
			return DownloadSummary{}, err
		}
	} else {
		if len(input.TorrentBase64) > TorrentBase64Limit {
			return DownloadSummary{}, ErrTorrentMetadata
		}
		raw, decodeErr := base64.StdEncoding.Strict().DecodeString(input.TorrentBase64)
		if decodeErr != nil {
			return DownloadSummary{}, &TorrentError{Kind: ErrTorrentMetadata, Cause: decodeErr}
		}
		metadata, decodeErr := s.decoder.Decode(raw)
		if decodeErr != nil {
			return DownloadSummary{}, decodeErr
		}
		data.Metadata, data.InfoHash, data.Name, data.TotalBytes = raw, metadata.InfoHash, metadata.Name, metadata.TotalBytes
		for _, file := range metadata.Files {
			data.Files = append(data.Files, TorrentSelectionFile{TorrentFile: file})
		}
		digest := sha256.Sum256(raw)
		source = torrentUploadPrefix + hex.EncodeToString(digest[:])
		state = model.DownloadSelecting
	}
	now := s.transfers.files.clock.Now().UTC()
	task := model.DownloadTask{ID: identifier, OwnerID: owner, Kind: model.DownloadBitTorrent, SourceURI: source, SourceOrigin: torrentSourceOrigin, TargetParentID: input.ParentID, RequestedName: input.Name, ClientKey: input.ClientKey, State: state, Intent: model.DownloadRun, Revision: 1, CreatedAt: now, UpdatedAt: now, ExpiresAt: now.Add(s.transfers.policy.Lifetime)}
	if err := model.ValidateDownloadTask(task); err != nil {
		return DownloadSummary{}, err
	}
	created, err := s.repo.CreateTorrent(ctx, task, data, func(snapshot TorrentSnapshot) error {
		if snapshot.MetadataLimited {
			return model.ErrDownloadMetadataLimited
		}
		if snapshot.OwnerDownloadRecords >= s.policy.OwnerRecords || snapshot.GlobalDownloadRecords >= s.policy.GlobalRecords {
			return model.ErrDownloadLimit
		}
		if snapshot.OwnerReservedCount >= int64(s.transfers.policy.OwnerCount) || snapshot.GlobalReservedCount >= int64(s.transfers.policy.GlobalCount) {
			return model.ErrBusy
		}
		return model.Parent(snapshot.Entries, input.ParentID)
	})
	if err != nil {
		return DownloadSummary{}, err
	}
	return s.summary(created), nil
}

type TorrentFileSummary struct {
	Index     int    `json:"index"`
	Path      string `json:"path"`
	SizeBytes int64  `json:"sizeBytes"`
	Selected  bool   `json:"selected"`
}

type TorrentDetail struct {
	Task       DownloadSummary      `json:"task"`
	Files      []TorrentFileSummary `json:"files"`
	TotalBytes int64                `json:"totalBytes"`
	CanSelect  bool                 `json:"canSelect"`
}

func (s *TorrentDownloads) Detail(ctx context.Context, owner, id string) (TorrentDetail, error) {
	snapshot, err := s.repo.ReadTorrent(ctx, owner, id)
	if err != nil {
		return TorrentDetail{}, err
	}
	now := s.transfers.files.clock.Now().UTC()
	_, nodeAvailable := s.nodes[snapshot.Data.NodeID]
	result := TorrentDetail{Task: s.summary(snapshot), Files: []TorrentFileSummary{}, TotalBytes: snapshot.Data.TotalBytes, CanSelect: s.available && nodeAvailable && !snapshot.MetadataLimited && now.Before(snapshot.Task.ExpiresAt) && snapshot.Task.State == model.DownloadSelecting && !snapshot.Task.LeaseValid(now)}
	for _, binding := range snapshot.Bindings {
		if !binding.Cleaned && !binding.Stopped {
			result.CanSelect = false
		}
	}
	for _, file := range snapshot.Data.Files {
		result.Files = append(result.Files, TorrentFileSummary{Index: file.Index, Path: file.Path, SizeBytes: file.SizeBytes, Selected: file.Selected})
	}
	return result, nil
}

func (s *TorrentDownloads) Read(ctx context.Context, owner, id string) (DownloadSummary, error) {
	snapshot, err := s.repo.ReadTorrent(ctx, owner, id)
	if err != nil {
		return DownloadSummary{}, err
	}
	return s.summary(snapshot), nil
}

func (s *TorrentDownloads) summary(snapshot TorrentSnapshot) DownloadSummary {
	task, data := snapshot.Task, snapshot.Data
	destination, available := downloadDestination(snapshot.Entries, task.TargetParentID)
	name := task.RequestedName
	if name == "" {
		name = data.Name
	}
	if name == "" {
		name = "BitTorrent"
	}
	result := DownloadSummary{MetadataLimited: snapshot.MetadataLimited, ID: task.ID, ClientKey: task.ClientKey, Kind: task.Kind, Origin: task.SourceOrigin, Name: name, ParentID: task.TargetParentID, DestinationPath: destination, DestinationAvailable: available, State: task.State, FailureCode: task.FailureCode, DeclaredBytes: task.DeclaredBytes, ReceivedBytes: task.ReceivedBytes, RateBytesPerSecond: task.RateBytesPerSecond, ProgressAt: task.ProgressAt, Resumable: true, Attempts: task.Attempts, Revision: task.Revision, CreatedAt: task.CreatedAt, UpdatedAt: task.UpdatedAt, StartedAt: task.StartedAt, FinishedAt: task.FinishedAt, ExpiresAt: task.ExpiresAt, NodeID: data.NodeID, FileCount: len(data.Files)}
	if node, exists := s.nodes[data.NodeID]; exists {
		result.NodeName = node.Config.Name
	} else {
		result.NodeName = data.NodeID
	}
	result.CancelRequested = task.Intent == model.DownloadCancel
	result.CanCopySource = !torrentSourceIsUpload(task.SourceURI)
	for _, file := range data.Files {
		if file.Selected {
			result.SelectedCount++
		}
	}
	for _, child := range snapshot.Transfers {
		result.CleanupPending = result.CleanupPending || child.CleanupPending
	}
	for _, binding := range snapshot.Bindings {
		retained := binding.Phase == TorrentJobPayload && binding.Stopped && (task.State == model.DownloadPaused || task.State == model.DownloadFailed)
		if !binding.Cleaned && !retained {
			result.CleanupPending = true
		}
	}
	if task.State == model.DownloadCompleted {
		if len(data.Folders) > 0 {
			result.EntryID, result.ResultIsFolder = data.ResultFolderID, true
		} else if len(snapshot.Transfers) == 1 {
			result.EntryID = snapshot.Transfers[0].EntryID
		}
		entry, found := model.Find(snapshot.Entries, result.EntryID)
		result.ResultAvailable = found && model.Visible(snapshot.Entries, entry)
	}
	return result
}

// unchangedTorrentMutation 保留完整持久集合，调用方只显式改变当前动作拥有的字段。
func unchangedTorrentMutation(snapshot TorrentSnapshot) TorrentMutation {
	return TorrentMutation{Task: snapshot.Task, Data: snapshot.Data, Bindings: snapshot.Bindings, Transfers: snapshot.Transfers}
}

func torrentDesiredName(task model.DownloadTask, file TorrentFile, totalFiles int) string {
	if totalFiles == 1 && path.Dir(file.Path) == "." && task.RequestedName != "" {
		return task.RequestedName
	}
	return path.Base(file.Path)
}

func torrentSourceIsUpload(source string) bool { return strings.HasPrefix(source, torrentUploadPrefix) }
