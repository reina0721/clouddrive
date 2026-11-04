package httpbinding

import (
	"github.com/danielgtaylor/huma/v2"
	"strings"
)

// Resolve 区分缺失与显式空条件，避免Huma把首个空重复参数当作未提供。
func (*listInput) Resolve(ctx huma.Context) []error {
	address := ctx.URL()
	parameters := address.Query()
	if (parameters.Has("propertyMatch") || parameters.Has("propertyValue")) && !parameters.Has("propertyKey") {
		return []error{&huma.ErrorDetail{Location: "query.propertyKey", Message: "property key is required"}}
	}
	for _, name := range []string{"tags", "tagMatch", "propertyKey", "propertyMatch", "keywords", "kinds", "extensions", "scope", "match", "caseSensitive", "minBytes", "maxBytes", "createdFrom", "createdTo", "modifiedFrom", "modifiedTo", "foldersFirst", "page", "pageSize"} {
		for _, value := range parameters[name] {
			if strings.TrimSpace(value) == "" {
				return []error{&huma.ErrorDetail{Location: "query." + name, Message: "search parameter must not be empty"}}
			}
		}
	}
	return nil
}
