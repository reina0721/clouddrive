package service

import (
	"context"
	"errors"
	"io"
	"time"
)

const (
	MaxTorrentMetadataBytes = 1 << 20
	MaxTorrentFiles         = 200
	MaxTorrentPathSegments  = 32
	MaxTorrentPathBytes     = 4096
	TorrentRPCResponseBytes = 1 << 20
	TorrentRPCRequestTime   = 5 * time.Second
)

var (
	ErrTorrentNode        = errors.New("torrent node unavailable")
	ErrTorrentProtocol    = errors.New("torrent node protocol invalid")
	ErrTorrentBinding     = errors.New("torrent job binding changed")
	ErrTorrentMetadata    = errors.New("torrent metadata invalid")
	ErrTorrentUnsupported = errors.New("torrent metadata unsupported")
	ErrTorrentJobMissing  = errors.New("torrent node job missing")
)

// TorrentError 保留底层原因以识别取消和I/O失败，默认文本只暴露稳定分类。
// 节点、文件系统及解码器原文不能被误写入产品响应或普通日志。
type TorrentError struct {
	Kind  error
	Cause error
}

func (e *TorrentError) Error() string        { return e.Kind.Error() }
func (e *TorrentError) Unwrap() error        { return e.Cause }
func (e *TorrentError) Is(target error) bool { return target == e.Kind }

// TorrentSubmissionError 区分尚未写出请求与远端结果未知；不能从普通连接错误猜测已清理。
type TorrentSubmissionError struct {
	DefinitelyUnsent bool
	Acknowledged     bool
	Cause            error
}

func (e *TorrentSubmissionError) Error() string { return "torrent submission failed" }
func (e *TorrentSubmissionError) Unwrap() error { return e.Cause }

// TorrentJob 仅用于服务端持久绑定；GID和Directory不能由浏览器提供或对外返回。
// 每次领取生成新GID及目录，旧worker的控制不能命中新领取的实际任务。
type TorrentJob struct {
	GID       string
	Directory string
	Phase     TorrentJobPhase
}

type TorrentJobPhase string

const (
	TorrentJobMetadata TorrentJobPhase = "metadata"
	TorrentJobPayload  TorrentJobPhase = "payload"
)

type TorrentFile struct {
	Index     int
	Path      string
	SizeBytes int64
}

// TorrentMetadata 保留原始info字节的摘要，文件索引采用下载器的1based约定。
type TorrentMetadata struct {
	InfoHash   string
	Name       string
	TotalBytes int64
	Files      []TorrentFile
}

type TorrentNodeState string

const (
	TorrentNodeActive   TorrentNodeState = "active"
	TorrentNodeWaiting  TorrentNodeState = "waiting"
	TorrentNodePaused   TorrentNodeState = "paused"
	TorrentNodeComplete TorrentNodeState = "complete"
	TorrentNodeError    TorrentNodeState = "error"
	TorrentNodeRemoved  TorrentNodeState = "removed"
)

type TorrentNodeFile struct {
	Index         int
	Path          string
	SizeBytes     int64
	ReceivedBytes int64
	Selected      bool
}

// TorrentNodeProgress 不携带第三方错误原文、URI、凭据或节点响应快照。
type TorrentNodeProgress struct {
	State              TorrentNodeState
	InfoHash           string
	TotalBytes         int64
	ReceivedBytes      int64
	RateBytesPerSecond int64
	Files              []TorrentNodeFile
}

// TorrentNodeIdentity 只供节点准入及恢复核对，不投影原始会话ID到浏览器。
type TorrentNodeIdentity struct {
	Version   string
	SessionID string
}

// TorrentEngine 是下载用例消费的窄契约，不向调用方开放任意method/options。
// OpenCompleted的reader只在回调中有效，Adapter拥有关闭及路径约束责任。
type TorrentEngine interface {
	Probe(context.Context) (TorrentNodeIdentity, error)
	PersistSession(context.Context) error
	PrepareJob(context.Context, TorrentJob) error
	AddMetadata(context.Context, TorrentJob, string) error
	AddPayload(context.Context, TorrentJob, []byte, []int) error
	Progress(context.Context, TorrentJob) (TorrentNodeProgress, error)
	ReadMetadata(context.Context, TorrentJob, string) ([]byte, error)
	Pause(context.Context, TorrentJob) error
	Resume(context.Context, TorrentJob) error
	Remove(context.Context, TorrentJob) error
	OpenCompleted(context.Context, TorrentJob, TorrentFile, func(io.Reader) error) error
	ClonePartial(context.Context, TorrentJob, TorrentJob, []TorrentFile) error
	// CleanupStopped仅在调用方持久确认停止后使用；未知Add结果不能视作已停止。
	CleanupStopped(context.Context, TorrentJob) error
	// DiscardUnsubmitted仅供持久围栏证明从未发出Add的候选使用，不依赖节点在线。
	DiscardUnsubmitted(context.Context, TorrentJob) error
}

// TorrentMetadataDecoder 封装受限种子解析；第三方bencode类型不越过该边界。
type TorrentMetadataDecoder interface {
	NormalizeMagnet(string) (uri string, infoHash string, err error)
	Decode([]byte) (TorrentMetadata, error)
}
