package service

import (
	"context"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/clock"
)

const nodeProbeTimeout = 5 * time.Second

type WorkerCapability struct {
	Kind    BackgroundTaskKind `json:"kind" enum:"zip,extract,http,trash-expiry,blob-reclaim"`
	Enabled bool               `json:"enabled"`
}

type WorkerNode struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	DispatchEnabled bool   `json:"dispatchEnabled"`
	Concurrency     int    `json:"concurrency" minimum:"1"`
	ReservedBytes   int64  `json:"reservedBytes" minimum:"1"`
}

type WorkerNodeCatalog struct {
	Local []WorkerCapability `json:"local"`
	Nodes []WorkerNode       `json:"nodes"`
}

type WorkerNodeStats struct {
	DownloadBytesPerSecond int64 `json:"downloadBytesPerSecond" minimum:"0"`
	UploadBytesPerSecond   int64 `json:"uploadBytesPerSecond" minimum:"0"`
	Active                 int64 `json:"active" minimum:"0"`
	Waiting                int64 `json:"waiting" minimum:"0"`
	Stopped                int64 `json:"stopped" minimum:"0"`
}

type WorkerNodeCheck struct {
	Version   string    `json:"version"`
	CheckedAt time.Time `json:"checkedAt"`
	WorkerNodeStats
}

type WorkerNodeInspector interface {
	Probe(context.Context) (TorrentNodeIdentity, error)
	GlobalStats(context.Context) (WorkerNodeStats, error)
}

type WorkerNodeBinding struct {
	Node      WorkerNode
	Inspector WorkerNodeInspector
}

type workerNodeProbe struct {
	inspector WorkerNodeInspector
	inFlight  chan struct{}
}

type WorkerNodes struct {
	catalog WorkerNodeCatalog
	probes  map[string]workerNodeProbe
	clock   clock.Clock
}

// NewWorkerNodes 接收本代实际装配的节点，构造器不访问网络。
func NewWorkerNodes(local []WorkerCapability, nodes []WorkerNodeBinding, timeSource clock.Clock) (*WorkerNodes, error) {
	if timeSource == nil || len(nodes) > MaxTorrentNodes {
		return nil, fmt.Errorf("invalid worker node dependencies")
	}
	workers := &WorkerNodes{
		catalog: WorkerNodeCatalog{Local: append([]WorkerCapability{}, local...), Nodes: make([]WorkerNode, 0, len(nodes))},
		probes:  make(map[string]workerNodeProbe, len(nodes)), clock: timeSource,
	}
	for _, binding := range nodes {
		if _, duplicate := workers.probes[binding.Node.ID]; duplicate || !validTorrentNodeID(binding.Node.ID) || binding.Inspector == nil {
			return nil, fmt.Errorf("invalid worker node binding")
		}
		workers.catalog.Nodes = append(workers.catalog.Nodes, binding.Node)
		workers.probes[binding.Node.ID] = workerNodeProbe{inspector: binding.Inspector, inFlight: make(chan struct{}, 1)}
	}
	return workers, nil
}

func (s *WorkerNodes) Catalog() WorkerNodeCatalog {
	return WorkerNodeCatalog{
		Local: append([]WorkerCapability{}, s.catalog.Local...),
		Nodes: append([]WorkerNode{}, s.catalog.Nodes...),
	}
}

// Check 在同一超时内确认节点兼容性并读取全局统计。
func (s *WorkerNodes) Check(ctx context.Context, nodeID string) (WorkerNodeCheck, error) {
	probe, ok := s.probes[nodeID]
	if !ok {
		return WorkerNodeCheck{}, model.ErrMissing
	}
	select {
	case probe.inFlight <- struct{}{}:
		defer func() { <-probe.inFlight }()
	default:
		return WorkerNodeCheck{}, model.ErrDownloadLimit
	}
	bounded, cancel := context.WithTimeout(ctx, nodeProbeTimeout)
	defer cancel()
	identity, err := probe.inspector.Probe(bounded)
	if err != nil {
		return WorkerNodeCheck{}, err
	}
	stats, err := probe.inspector.GlobalStats(bounded)
	if err != nil {
		return WorkerNodeCheck{}, err
	}
	return WorkerNodeCheck{Version: identity.Version, CheckedAt: s.clock.Now().UTC(), WorkerNodeStats: stats}, nil
}
