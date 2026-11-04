package configbinding

import (
	"context"
	"fmt"

	"github.com/reina0721/clouddrive/internal/kernel/config"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

func pdfReaderDefaults(ctx context.Context) (config.Object, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	p := service.DefaultPDFReaderPolicy()
	fields := config.Object{}
	for _, field := range []struct {
		name  string
		value int
	}{{"maxPages", p.MaxPages}, {"maxCanvasPixels", p.MaxCanvasPixels}, {"maxImagePixels", p.MaxImagePixels}, {"maxOutlineEntries", p.MaxOutlineEntries}, {"maxOutlineDepth", p.MaxOutlineDepth}, {"maxThumbnailPixels", p.MaxThumbnailPixels}, {"maxThumbnailBytes", p.MaxThumbnailBytes}} {
		number, err := config.Number(fmt.Sprint(field.value))
		if err != nil {
			return nil, err
		}
		fields = append(fields, config.FieldOf(field.name, number))
	}
	return append(fields, config.FieldOf("workTimeout", config.String(p.WorkTimeout.String())), config.FieldOf("workerReadyTimeout", config.String(p.WorkerReadyTimeout.String()))), nil
}
