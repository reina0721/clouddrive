package service

import (
	"testing"
	"time"
)

func TestPDFReaderPolicyLimits(t *testing.T) {
	p := DefaultPDFReaderPolicy()
	if err := p.Validate(); err != nil {
		t.Fatal(err)
	}
	limits := p.Limits(1024)
	if limits.MaxBytes != 1024 || limits.WorkTimeoutMs != 30000 || limits.WorkerReadyTimeoutMs != 10000 {
		t.Fatalf("预算投影不一致: %+v", limits)
	}
	// 每个配置均拒绝零、负数和超过默认上界，允许受控收紧。
	for _, field := range []func(*PDFReaderPolicy) *int{
		func(p *PDFReaderPolicy) *int { return &p.MaxPages }, func(p *PDFReaderPolicy) *int { return &p.MaxCanvasPixels }, func(p *PDFReaderPolicy) *int { return &p.MaxImagePixels }, func(p *PDFReaderPolicy) *int { return &p.MaxOutlineEntries }, func(p *PDFReaderPolicy) *int { return &p.MaxOutlineDepth }, func(p *PDFReaderPolicy) *int { return &p.MaxThumbnailPixels }, func(p *PDFReaderPolicy) *int { return &p.MaxThumbnailBytes },
	} {
		for _, value := range []int{0, -1, *field(&p) + 1} {
			candidate := p
			*field(&candidate) = value
			if err := candidate.Validate(); err == nil {
				t.Fatalf("应拒绝无效预算%d", value)
			}
		}
		candidate := p
		*field(&candidate) = 1
		if err := candidate.Validate(); err != nil {
			t.Fatal(err)
		}
	}
	for _, duration := range []time.Duration{0, -1, time.Second * 31} {
		candidate := p
		candidate.WorkTimeout = duration
		if err := candidate.Validate(); err == nil {
			t.Fatalf("应拒绝无效时间%d", duration)
		}
	}
}
