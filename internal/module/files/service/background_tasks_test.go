package service

import (
	"context"
	"fmt"
	"testing"
	"time"
)

type backgroundFixture []BackgroundTask

func (f backgroundFixture) ListBackgroundTasks(context.Context, string) ([]BackgroundTask, error) {
	return f, nil
}

func TestBackgroundTasksMergeFiltersAndPages(t *testing.T) {
	ctx := context.Background()
	at := time.Date(2026, time.November, 1, 0, 0, 0, 0, time.UTC)
	records := backgroundFixture{
		{ID: "21", Kind: BackgroundTaskZIP, State: "completed", SourceName: "同名 Video", CreatedAt: at},
		{ID: "21", Kind: BackgroundTaskHTTP, State: "paused", SourceName: "同名 Video", CreatedAt: at},
		{ID: "22", Kind: BackgroundTaskExtract, State: "failed", SourceName: "示例", CreatedAt: at},
	}
	for index := range 20 {
		records = append(records, BackgroundTask{
			ID: fmt.Sprintf("%02d", index), Kind: BackgroundTaskBitTorrent, State: "expired",
			SourceName: "同名 video", CreatedAt: at.Add(-time.Second),
		})
	}
	reader, err := NewBackgroundTasks(records, &ArchiveTasks{available: true})
	if err != nil {
		t.Fatal(err)
	}
	query := BackgroundTaskQuery{Kind: BackgroundTaskAny, Status: BackgroundStatusAll, Page: 1}
	listing, err := reader.List(ctx, "owner", query)
	if err != nil || listing.Total != 23 || !listing.ArchiveAvailable || len(listing.Items) != 20 {
		t.Fatalf("汇总首页结果错误，记录数 %d，错误 %v", len(listing.Items), err)
	}
	if listing.Items[0].ID != "22" || listing.Items[1].Kind != BackgroundTaskHTTP || listing.Items[2].Kind != BackgroundTaskZIP {
		t.Fatal("相同时间的身份与类型排序不稳定")
	}
	query.Page = 1000
	listing, err = reader.List(ctx, "owner", query)
	if err != nil || listing.Page != 2 || len(listing.Items) != 3 || listing.Items[2].ID != "00" {
		t.Fatal("跨页记录丢失或越界页未回到末页")
	}
	query.Kind, query.Status, query.Search = BackgroundTaskHTTP, BackgroundStatusActive, "  同名 vIdEo "
	listing, err = reader.List(ctx, "owner", query)
	if err != nil || listing.Total != 1 || listing.UnfilteredTotal != 23 || listing.Page != 1 || listing.Items[0].DeclaredBytes != nil {
		t.Fatal("合并筛选、未知总量或空页边界错误")
	}
	query.Status = BackgroundStatusExpired
	listing, err = reader.List(ctx, "owner", query)
	if err != nil || listing.Items == nil || len(listing.Items) != 0 {
		t.Fatal("筛选空结果必须返回空列表")
	}
}
