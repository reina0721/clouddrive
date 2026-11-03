// Package model 的偏好领域类型（BE-090-005）：跨设备用户偏好契约。
package model

import (
	"errors"
	"strings"
)

// ErrInvalidPreferences 表示偏好键或值非法（未知键、非法枚举或格式错误）。
var ErrInvalidPreferences = errors.New("iam preferences are invalid")

// PreferenceThemeMode 是界面主题模式的稳定枚举。
type PreferenceThemeMode string

const (
	PreferenceThemeModeSystem PreferenceThemeMode = "system"
	PreferenceThemeModeLight  PreferenceThemeMode = "light"
	PreferenceThemeModeDark   PreferenceThemeMode = "dark"
)

// PreferenceThemePreset 是主题强调色的稳定枚举。
type PreferenceThemePreset string

const (
	PreferenceThemePresetBlue   PreferenceThemePreset = "blue"
	PreferenceThemePresetCyan   PreferenceThemePreset = "cyan"
	PreferenceThemePresetGreen  PreferenceThemePreset = "green"
	PreferenceThemePresetViolet PreferenceThemePreset = "violet"
	PreferenceThemePresetOrange PreferenceThemePreset = "orange"
)

// PreferenceDensity 是内容密度的稳定枚举。
type PreferenceDensity string

const (
	PreferenceDensityComfortable PreferenceDensity = "comfortable"
	PreferenceDensityCompact     PreferenceDensity = "compact"
)

// PreferenceLanguage 是界面语言的稳定枚举（与 WebUI 宿主 locale 对齐）。
type PreferenceLanguage string

const (
	PreferenceLanguageZhCN PreferenceLanguage = "zh-CN"
	PreferenceLanguageEnUS PreferenceLanguage = "en-US"
)

// PreferenceTimeZone 是 IANA 时区标识；服务端只做格式校验（"Area/Location"），
// 具体渲染由客户端 Intl 消费。空值表示跟随系统。
type PreferenceTimeZone string

// UserPreferences 是账号跨设备偏好的稳定值对象：字段为默认值合并用户覆盖
// 后的有效值。新增偏好键必须同步 default、校验与编码（单轨演进）。
type UserPreferences struct {
	Version      uint64
	Language     PreferenceLanguage
	TimeZone     PreferenceTimeZone
	ThemeMode    PreferenceThemeMode
	ThemePreset  PreferenceThemePreset
	Density      PreferenceDensity
	ReduceMotion bool
	// Notifications 是低风险通知偏好（090 P0 只承载展示语义，异步通知服务
	// 属 P1/P2，契约先同步字段）。
	Notifications NotificationPreferences
}

// NotificationPreferences 是通知相关的布尔偏好。
type NotificationPreferences struct {
	EmailDigest   bool
	InApp         bool
	ShowSummaries bool
	DailySummary  bool
}

// DefaultUserPreferences 返回偏好的系统默认值；缺失时由 service 层补齐。
func DefaultUserPreferences() UserPreferences {
	return UserPreferences{
		Language:    PreferenceLanguageEnUS,
		ThemeMode:   PreferenceThemeModeSystem,
		ThemePreset: PreferenceThemePresetBlue,
		Density:     PreferenceDensityComfortable,
		Notifications: NotificationPreferences{
			EmailDigest:   true,
			InApp:         true,
			ShowSummaries: true,
			DailySummary:  false,
		},
	}
}

// Validate 校验「有效偏好值」的合法性：所有枚举字段必须非空且属于白名单；
// 非法返回 ErrInvalidPreferences。空语言/时区表示「未设置（跟随系统）」，合法。
func (p UserPreferences) Validate() error {
	if p.Language != "" && p.Language != PreferenceLanguageZhCN && p.Language != PreferenceLanguageEnUS {
		return ErrInvalidPreferences
	}
	if p.TimeZone != "" && !isValidTimeZone(string(p.TimeZone)) {
		return ErrInvalidPreferences
	}
	switch p.ThemeMode {
	case PreferenceThemeModeSystem, PreferenceThemeModeLight, PreferenceThemeModeDark:
	default:
		return ErrInvalidPreferences
	}
	switch p.ThemePreset {
	case PreferenceThemePresetBlue, PreferenceThemePresetCyan, PreferenceThemePresetGreen, PreferenceThemePresetViolet, PreferenceThemePresetOrange:
	default:
		return ErrInvalidPreferences
	}
	switch p.Density {
	case PreferenceDensityComfortable, PreferenceDensityCompact:
	default:
		return ErrInvalidPreferences
	}
	return nil
}

// ValidatePartial 校验「部分更新/存储覆盖」的合法性：只校验非空字段（PATCH
// 省略字段表示为设置），空枚举字段合法；用于合并前的更新与解码路径。
func (p UserPreferences) ValidatePartial() error {
	if p.Language != "" && p.Language != PreferenceLanguageZhCN && p.Language != PreferenceLanguageEnUS {
		return ErrInvalidPreferences
	}
	if p.TimeZone != "" && !isValidTimeZone(string(p.TimeZone)) {
		return ErrInvalidPreferences
	}
	switch p.ThemeMode {
	case "", PreferenceThemeModeSystem, PreferenceThemeModeLight, PreferenceThemeModeDark:
	default:
		return ErrInvalidPreferences
	}
	switch p.ThemePreset {
	case "", PreferenceThemePresetBlue, PreferenceThemePresetCyan, PreferenceThemePresetGreen, PreferenceThemePresetViolet, PreferenceThemePresetOrange:
	default:
		return ErrInvalidPreferences
	}
	switch p.Density {
	case "", PreferenceDensityComfortable, PreferenceDensityCompact:
	default:
		return ErrInvalidPreferences
	}
	return nil
}

// isValidTimeZone 只做结构校验：非空、不含空白、含 "/" 且首段非数字。
// 完整 IANA 校验由客户端 Intl.DateTimeFormat 执行；服务端不引入时区数据库
// 依赖，保持窄契约（无效值在前端立即降级为跟随系统）。
func isValidTimeZone(value string) bool {
	if strings.TrimSpace(value) == "" || strings.ContainsAny(value, " \t\n") {
		return false
	}
	slash := strings.IndexByte(value, '/')
	if slash <= 0 || slash == len(value)-1 {
		return false
	}
	region := value[:slash]
	if region == "" {
		return false
	}
	first := region[0]
	return first >= 'A' && first <= 'Z'
}
