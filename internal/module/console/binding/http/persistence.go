package httpbinding

import (
	"context"
	"github.com/reina0721/clouddrive/internal/module/console/model"
	"time"
)

// Persistence 是控制台用例使用方拥有的持久化端口；binding 不导入仓库实现或 SQL。
// module.New 在本模块内显式选择 repo，composition 只连接模块公开契约。
type Persistence interface {
	Record(context.Context, model.Event) error
	Workspace(context.Context, string) (model.WorkspaceRecord, error)
	SaveWorkspace(context.Context, model.WorkspaceRecord) error
	SiteProfile(context.Context) (model.SiteProfileVersion, error)
	SaveSiteProfile(context.Context, model.SiteProfileVersion) (model.SiteProfileVersion, error)
	Notification(context.Context, string, string) (model.Notification, error)
	Notifications(context.Context, string, model.NotificationQuery) ([]model.Notification, int64, int64, error)
	ReadNotifications(context.Context, string, []string, bool) error
	Event(context.Context, string) (model.Event, error)
	Events(context.Context, model.EventQuery) ([]model.Event, int64, error)
	DailyCounts(context.Context, string, time.Time, int) ([]model.DailyCount, error)
	Dictionaries(context.Context) ([]model.Dictionary, []model.DictionaryItem, error)
	SaveDictionary(context.Context, string, model.Dictionary) error
	DeleteDictionary(context.Context, string, uint64) error
	SaveDictionaryItem(context.Context, string, string, model.DictionaryItem) error
	DeleteDictionaryItem(context.Context, string, uint64) error
	Tasks(context.Context, string) ([]model.TaskRecord, error)
	DeleteTask(context.Context, string, string, string) error
	UpsertTask(context.Context, model.TaskRecord) error
	DueTasks(context.Context, time.Time, int) ([]model.TaskRecord, error)
	ClaimTask(context.Context, string, uint64, time.Time, time.Time) (bool, error)
	TaskResult(context.Context, string, uint64, string) error
}
