package service

import (
	"fmt"
	"time"
)

// PDFReaderPolicy 约束浏览器阅读工作，不承诺浏览器Worker的硬堆内存上限。
type PDFReaderPolicy struct {
	MaxPages           int           `mapstructure:"maxPages"`
	MaxCanvasPixels    int           `mapstructure:"maxCanvasPixels"`
	MaxImagePixels     int           `mapstructure:"maxImagePixels"`
	MaxOutlineEntries  int           `mapstructure:"maxOutlineEntries"`
	MaxOutlineDepth    int           `mapstructure:"maxOutlineDepth"`
	MaxThumbnailPixels int           `mapstructure:"maxThumbnailPixels"`
	MaxThumbnailBytes  int           `mapstructure:"maxThumbnailBytes"`
	WorkTimeout        time.Duration `mapstructure:"workTimeout"`
	WorkerReadyTimeout time.Duration `mapstructure:"workerReadyTimeout"`
}

// DefaultPDFReaderPolicy 集中声明仅允许收紧的阅读工作预算。
func DefaultPDFReaderPolicy() PDFReaderPolicy {
	return PDFReaderPolicy{
		MaxPages: 500, MaxCanvasPixels: 4 << 20, MaxImagePixels: 8 << 20,
		MaxOutlineEntries: 500, MaxOutlineDepth: 16,
		MaxThumbnailPixels: 1 << 16, MaxThumbnailBytes: 512 << 10,
		WorkTimeout: 30 * time.Second, WorkerReadyTimeout: 10 * time.Second,
	}
}

// Validate 拒绝无效值及超过默认上界的策略。
func (p PDFReaderPolicy) Validate() error {
	ceiling := DefaultPDFReaderPolicy()
	for _, pair := range [][2]int{{p.MaxPages, ceiling.MaxPages}, {p.MaxCanvasPixels, ceiling.MaxCanvasPixels}, {p.MaxImagePixels, ceiling.MaxImagePixels}, {p.MaxOutlineEntries, ceiling.MaxOutlineEntries}, {p.MaxOutlineDepth, ceiling.MaxOutlineDepth}, {p.MaxThumbnailPixels, ceiling.MaxThumbnailPixels}, {p.MaxThumbnailBytes, ceiling.MaxThumbnailBytes}} {
		if pair[0] < 1 || pair[0] > pair[1] {
			return fmt.Errorf("invalid PDF reader size budget")
		}
	}
	if p.WorkTimeout < time.Millisecond || p.WorkTimeout > ceiling.WorkTimeout || p.WorkerReadyTimeout < time.Millisecond || p.WorkerReadyTimeout > ceiling.WorkerReadyTimeout {
		return fmt.Errorf("invalid PDF reader time budget")
	}
	return nil
}

// PDFReaderLimits 将配置投影为明确字节/像素/毫秒单位，不暴露解析器类型。
type PDFReaderLimits struct {
	MaxBytes             int64 `json:"maxBytes"`
	MaxPages             int   `json:"maxPages"`
	MaxCanvasPixels      int   `json:"maxCanvasPixels"`
	MaxImagePixels       int   `json:"maxImagePixels"`
	MaxOutlineEntries    int   `json:"maxOutlineEntries"`
	MaxOutlineDepth      int   `json:"maxOutlineDepth"`
	MaxThumbnailPixels   int   `json:"maxThumbnailPixels"`
	MaxThumbnailBytes    int   `json:"maxThumbnailBytes"`
	WorkTimeoutMs        int64 `json:"workTimeoutMs"`
	WorkerReadyTimeoutMs int64 `json:"workerReadyTimeoutMs"`
}

// Limits 投影为与源码预算一致的浏览器契约。
func (p PDFReaderPolicy) Limits(maxBytes int64) PDFReaderLimits {
	return PDFReaderLimits{MaxBytes: maxBytes, MaxPages: p.MaxPages, MaxCanvasPixels: p.MaxCanvasPixels, MaxImagePixels: p.MaxImagePixels, MaxOutlineEntries: p.MaxOutlineEntries, MaxOutlineDepth: p.MaxOutlineDepth, MaxThumbnailPixels: p.MaxThumbnailPixels, MaxThumbnailBytes: p.MaxThumbnailBytes, WorkTimeoutMs: p.WorkTimeout.Milliseconds(), WorkerReadyTimeoutMs: p.WorkerReadyTimeout.Milliseconds()}
}
