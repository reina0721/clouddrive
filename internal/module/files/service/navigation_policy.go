package service

import "fmt"

const (
	DefaultShortcutLimit         = 100
	DefaultPinLimit              = 20
	DefaultNavigationTreeEntries = 10000
	DefaultShortcutPageSize      = 20
)

// NavigationPolicy 约束账号引用、侧栏和每次元数据读取，不拥有运行资源。
type NavigationPolicy struct {
	ShortcutLimit int
	PinLimit      int
	TreeEntries   int
	PageSize      int
}

func DefaultNavigationPolicy() NavigationPolicy {
	return NavigationPolicy{ShortcutLimit: DefaultShortcutLimit, PinLimit: DefaultPinLimit, TreeEntries: DefaultNavigationTreeEntries, PageSize: DefaultShortcutPageSize}
}
func (policy NavigationPolicy) Validate() error {
	if policy.ShortcutLimit < 1 || policy.ShortcutLimit > DefaultShortcutLimit || policy.PinLimit < 1 || policy.PinLimit > DefaultPinLimit || policy.TreeEntries < 1 || policy.TreeEntries > DefaultNavigationTreeEntries || policy.PageSize < 1 || policy.PageSize > DefaultShortcutPageSize {
		return fmt.Errorf("invalid file navigation budgets")
	}
	return nil
}
