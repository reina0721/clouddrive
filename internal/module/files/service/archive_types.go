package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	DefaultArchiveTimeout                 = 30 * time.Second
	DefaultArchiveWorkerMemoryBytes int64 = 512 << 20
	MinArchiveWorkerMemoryBytes     int64 = 128 << 20
	MaxArchivePasswordBytes               = 1024
	MaxArchivePathBytes                   = 4096
	MaxArchiveDepth                       = 32
)

// ArchivePolicy 仅治理单次解析进程，文件数量和空间沿用文件政策。
type ArchivePolicy struct {
	Timeout           time.Duration `mapstructure:"timeout"`
	WorkerMemoryBytes int64         `mapstructure:"workerMemoryBytes"`
}

func DefaultArchivePolicy() ArchivePolicy {
	return ArchivePolicy{DefaultArchiveTimeout, DefaultArchiveWorkerMemoryBytes}
}
func (p ArchivePolicy) Validate() error {
	if p.Timeout <= 0 || p.Timeout > DefaultArchiveTimeout || p.WorkerMemoryBytes < MinArchiveWorkerMemoryBytes || p.WorkerMemoryBytes > DefaultArchiveWorkerMemoryBytes {
		return fmt.Errorf("invalid archive worker budgets")
	}
	return nil
}

var ErrArchivePassword = errors.New("archive password required or incorrect")
var ErrArchiveChecksum = errors.New("archive member checksum mismatch")
var ErrArchiveWorker = errors.New("archive worker unavailable")

type ArchiveReadMode string

const (
	ArchiveInspect      ArchiveReadMode = "inspect"
	ArchiveReadAll      ArchiveReadMode = "all"
	ArchiveReadSelected ArchiveReadMode = "selected"
)

// ArchiveMember 表达虚拟成员，不携带存储位置或第三方解码类型。
type ArchiveMember struct {
	Path      string     `json:"path"`
	Kind      model.Kind `json:"kind"`
	SizeBytes int64      `json:"sizeBytes"`
}
type ArchivePayload struct {
	Path    string `json:"path"`
	Content []byte `json:"content"`
}
type ArchiveParseRequest struct {
	Content    []byte          `json:"content"`
	Password   string          `json:"password"`
	Mode       ArchiveReadMode `json:"mode"`
	Paths      []string        `json:"paths"`
	MaxBytes   int64           `json:"maxBytes"`
	MaxMembers int             `json:"maxMembers"`
}
type ArchiveParseResult struct {
	Format   string           `json:"format"`
	Members  []ArchiveMember  `json:"members"`
	Payloads []ArchivePayload `json:"payloads"`
}

// ArchiveProcessor 由files消费，负责受限解析，不负责文件发布或鉴权。
type ArchiveProcessor interface {
	Process(context.Context, ArchiveParseRequest) (ArchiveParseResult, error)
}

// ArchiveSelection 的all要求paths为空；selected至少有一路径，目录包含所有后代。
type ArchiveSelection struct {
	Mode  ArchiveReadMode `json:"mode" enum:"all,selected"`
	Paths []string        `json:"paths" maxItems:"500"`
}
type ArchiveManifest struct {
	Entry         model.Entry     `json:"entry"`
	Format        string          `json:"format"`
	Members       []ArchiveMember `json:"members"`
	TotalBytes    int64           `json:"totalBytes"`
	MaxBytes      int64           `json:"maxBytes"`
	MaxMembers    int             `json:"maxMembers"`
	MaxTextBytes  int64           `json:"maxTextBytes"`
	MaxImageBytes int64           `json:"maxImageBytes"`
}
type ArchiveConflict string

const (
	ArchiveReject ArchiveConflict = "reject"
	ArchiveSkip   ArchiveConflict = "skip"
	ArchiveRename ArchiveConflict = "rename"
)

// ArchiveExtractRequest 的空ParentID表示本人根目录，空FolderName表示直接提取到目标。
type ArchiveExtractRequest struct {
	ExpectedRevision int64            `json:"expectedRevision" minimum:"1"`
	Password         string           `json:"password" maxLength:"1024"`
	Selection        ArchiveSelection `json:"selection"`
	ParentID         string           `json:"parentId" maxLength:"36"`
	FolderName       string           `json:"folderName" maxLength:"255"`
	Conflict         ArchiveConflict  `json:"conflict" enum:"reject,skip,rename"`
}
type ArchiveRenamed struct {
	Path string `json:"path"`
	Name string `json:"name"`
}

// ArchiveReceipt 只描述已提交结果；空切片表示没有该类变化，不表示操作仍在后台进行。
type ArchiveReceipt struct {
	DestinationID string           `json:"destinationId"`
	Created       []model.Entry    `json:"created"`
	Skipped       []string         `json:"skipped"`
	Renamed       []ArchiveRenamed `json:"renamed"`
}
