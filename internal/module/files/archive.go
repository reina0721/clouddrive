package files

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/reina0721/clouddrive/internal/module/files/adapter/archiveprocess"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/logger"
)

// ArchiveWorkerArgument 是当前程序的私有解析入口，不接受其他命令或shell。
const ArchiveWorkerArgument = archiveprocess.WorkerArgument

// NewArchiveProcessor 在模块边界内装配受限解析器，仅向装配方返回使用方契约。
func NewArchiveProcessor(policy service.ArchivePolicy, log logger.Logger) (service.ArchiveProcessor, error) {
	executable, err := os.Executable()
	if err != nil {
		return nil, fmt.Errorf("resolve archive executable: %w", err)
	}
	return archiveprocess.New(archiveprocess.Options{Executable: executable, Policy: policy, Logger: log})
}

// RunArchiveWorker 仅执行受限字节协议，不装配数据库、配置或日志sink。
func RunArchiveWorker(ctx context.Context, input io.Reader, output io.Writer, args []string) error {
	return archiveprocess.RunWorker(ctx, input, output, args)
}
