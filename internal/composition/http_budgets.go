package composition

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/console"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
)

// transferBudgetMatcher 由同一 operation catalog 派生原生与 console 投影的精确匹配。
// 这里只选择预算，不执行 handler，也不改变后续认证、CSRF 或授权门禁。
func transferBudgetMatcher(definitions []humabinding.Definition, protocolTransfer func(*http.Request) bool) (matcher func(*http.Request) bool, resultErr error) {
	defer func() {
		if cause := recover(); cause != nil {
			matcher = nil
			resultErr = fmt.Errorf("invalid transfer budget route: %v", cause)
		}
	}()
	mux := http.NewServeMux()
	seen := map[string]bool{}
	for _, definition := range definitions {
		if definition.Budget == humabinding.BudgetDefault {
			continue
		}
		if definition.Budget != humabinding.BudgetTransfer {
			return nil, fmt.Errorf("unknown request budget profile")
		}
		paths := []string{definition.Path}
		if strings.HasPrefix(definition.Path, console.NativeTargetPrefix) {
			paths = append(paths, console.NativePrefix+strings.TrimPrefix(definition.Path, console.NativeTargetPrefix))
		}
		for _, path := range paths {
			pattern := definition.Method + " " + path
			if seen[pattern] {
				return nil, fmt.Errorf("duplicate transfer budget operation")
			}
			seen[pattern] = true
			mux.Handle(pattern, http.NotFoundHandler())
		}
	}
	return func(request *http.Request) bool {
		if protocolTransfer != nil && protocolTransfer(request) {
			return true
		}
		_, pattern := mux.Handler(request)
		return pattern != ""
	}, nil
}
