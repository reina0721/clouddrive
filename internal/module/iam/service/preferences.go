package service

import (
	"encoding/json"
	"fmt"

	"github.com/reina0721/clouddrive/internal/module/iam/model"
)

// preferenceJSON 是偏好覆盖的持久化形状：与 model.UserPreferences 同构，
// 但只承载用户显式设置过的字段（service 层以默认值合并后整体编码，保证
// 未来新增键时旧数据仍能解析——缺省字段回退默认）。
type preferenceJSON struct {
	Language      string                       `json:"language,omitempty"`
	TimeZone      string                       `json:"timeZone,omitempty"`
	ThemeMode     string                       `json:"themeMode,omitempty"`
	ThemePreset   string                       `json:"themePreset,omitempty"`
	Density       string                       `json:"density,omitempty"`
	ReduceMotion  *bool                        `json:"reduceMotion,omitempty"`
	Notifications *preferenceNotificationsJSON `json:"notifications,omitempty"`
}

type preferenceNotificationsJSON struct {
	EmailDigest   *bool `json:"emailDigest,omitempty"`
	InApp         *bool `json:"inApp,omitempty"`
	ShowSummaries *bool `json:"showSummaries,omitempty"`
	DailySummary  *bool `json:"dailySummary,omitempty"`
}

// encodePreferenceOverrides 把有效偏好整体编码为覆盖 JSON（存储层只存一行，
// 键的增删由服务端版本控制，避免客户端传入任意键）。
func encodePreferenceOverrides(value model.UserPreferences) (string, error) {
	payload := preferenceJSON{
		Language:     string(value.Language),
		TimeZone:     string(value.TimeZone),
		ThemeMode:    string(value.ThemeMode),
		ThemePreset:  string(value.ThemePreset),
		Density:      string(value.Density),
		ReduceMotion: boolPointer(value.ReduceMotion),
		Notifications: &preferenceNotificationsJSON{
			EmailDigest:   boolPointer(value.Notifications.EmailDigest),
			InApp:         boolPointer(value.Notifications.InApp),
			ShowSummaries: boolPointer(value.Notifications.ShowSummaries),
			DailySummary:  boolPointer(value.Notifications.DailySummary),
		},
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal user preferences: %w", err)
	}
	return string(encoded), nil
}

// decodePreferenceOverrides 解析持久化覆盖；结构非法或字段类型错误返回
// 错误（不静默回退默认，避免掩盖存储损坏）。
func decodePreferenceOverrides(raw string) (model.UserPreferences, error) {
	var payload preferenceJSON
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return model.UserPreferences{}, fmt.Errorf("parse user preferences: %w", err)
	}
	value := model.UserPreferences{
		Language:     model.PreferenceLanguage(payload.Language),
		TimeZone:     model.PreferenceTimeZone(payload.TimeZone),
		ThemeMode:    model.PreferenceThemeMode(payload.ThemeMode),
		ThemePreset:  model.PreferenceThemePreset(payload.ThemePreset),
		Density:      model.PreferenceDensity(payload.Density),
		ReduceMotion: boolValue(payload.ReduceMotion),
	}
	if payload.Notifications != nil {
		value.Notifications = model.NotificationPreferences{
			EmailDigest:   boolValue(payload.Notifications.EmailDigest),
			InApp:         boolValue(payload.Notifications.InApp),
			ShowSummaries: boolValue(payload.Notifications.ShowSummaries),
			DailySummary:  boolValue(payload.Notifications.DailySummary),
		}
	}
	if err := value.ValidatePartial(); err != nil {
		return model.UserPreferences{}, err
	}
	return value, nil
}

// mergePreferenceDefaults 把默认值作为底，覆盖已设置字段（解码路径：存储的
// 覆盖整体编码自有效值，布尔与枚举字段在存储中始终存在，直接覆盖即可）。
func mergePreferenceDefaults(defaults, overrides model.UserPreferences) model.UserPreferences {
	merged := defaults
	if overrides.Language != "" {
		merged.Language = overrides.Language
	}
	if overrides.TimeZone != "" {
		merged.TimeZone = overrides.TimeZone
	}
	if overrides.ThemeMode != "" {
		merged.ThemeMode = overrides.ThemeMode
	}
	if overrides.ThemePreset != "" {
		merged.ThemePreset = overrides.ThemePreset
	}
	if overrides.Density != "" {
		merged.Density = overrides.Density
	}
	merged.ReduceMotion = overrides.ReduceMotion
	merged.Notifications = overrides.Notifications
	return merged
}

// NotificationUpdate 是通知布尔更新的显式集合：nil 表示该字段未提交
// （PATCH 语义），避免「全部置 false」与「未提交」在布尔值上不可区分。
type NotificationUpdate struct {
	EmailDigest   *bool
	InApp         *bool
	ShowSummaries *bool
	DailySummary  *bool
}

// mergePreferenceUpdates 把「当前有效值」与「本次更新」合并：更新中出现的
// 字段覆盖，未出现的字段保持原值；主题/密度/语言枚举按空串表示未设置。
// notifications 以显式指针集合传入（HTTP binding 从 JSON 指针构造），
// 从而区分「未提交」与「显式关闭」。
func mergePreferenceUpdates(current model.UserPreferences, updates model.UserPreferences, notifications *NotificationUpdate) model.UserPreferences {
	merged := current
	if updates.Language != "" {
		merged.Language = updates.Language
	}
	if updates.TimeZone != "" {
		merged.TimeZone = updates.TimeZone
	}
	if updates.ThemeMode != "" {
		merged.ThemeMode = updates.ThemeMode
	}
	if updates.ThemePreset != "" {
		merged.ThemePreset = updates.ThemePreset
	}
	if updates.Density != "" {
		merged.Density = updates.Density
	}
	if updates.ReduceMotion {
		merged.ReduceMotion = true
	}
	if notifications != nil {
		if notifications.EmailDigest != nil {
			merged.Notifications.EmailDigest = *notifications.EmailDigest
		}
		if notifications.InApp != nil {
			merged.Notifications.InApp = *notifications.InApp
		}
		if notifications.ShowSummaries != nil {
			merged.Notifications.ShowSummaries = *notifications.ShowSummaries
		}
		if notifications.DailySummary != nil {
			merged.Notifications.DailySummary = *notifications.DailySummary
		}
	}
	return merged
}

func boolValue(pointer *bool) bool { return pointer != nil && *pointer }
