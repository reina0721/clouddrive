package composition

import (
	"fmt"

	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	webuicontract "github.com/reina0721/clouddrive/internal/webui"
	pkgobservability "github.com/reina0721/clouddrive/pkg/observability"
)

// applicationBlueprint 冻结只依赖代码声明的应用目录；它不持有配置、资源或运行期 Handler。
type applicationBlueprint struct {
	permissions     permissioncatalog.Catalog
	webuiCatalog    webuicontract.Catalog
	policies        []authmodel.Policy
	httpDefinitions []humabinding.Definition
	operations      []pkgobservability.Operation
}

func newApplicationBlueprint() (*applicationBlueprint, error) {
	definitions, err := applicationHTTPCatalog()
	if err != nil {
		return nil, fmt.Errorf("compose application HTTP catalog: %w", err)
	}
	permissions, err := applicationPermissionCatalog()
	if err != nil {
		return nil, fmt.Errorf("compose application permission catalog: %w", err)
	}
	policies, err := operationPoliciesFromDefinitions(definitions)
	if err != nil {
		return nil, fmt.Errorf("compose application operation policies: %w", err)
	}
	webuiCatalog, err := buildApplicationWebUICatalog(definitions, permissions, policies)
	if err != nil {
		return nil, fmt.Errorf("compose application WebUI catalog: %w", err)
	}
	operations := make([]pkgobservability.Operation, len(definitions))
	for index, operation := range definitions {
		operations[index] = pkgobservability.Operation{ID: operation.ID, Method: operation.Method, Path: operation.Path}
	}
	return &applicationBlueprint{
		permissions: permissions, webuiCatalog: webuiCatalog,
		policies:        append([]authmodel.Policy(nil), policies...),
		httpDefinitions: append([]humabinding.Definition(nil), definitions...),
		operations:      append([]pkgobservability.Operation(nil), operations...),
	}, nil
}

func (blueprint *applicationBlueprint) policyCopy() []authmodel.Policy {
	return append([]authmodel.Policy(nil), blueprint.policies...)
}

func (blueprint *applicationBlueprint) operationCopy() []pkgobservability.Operation {
	return append([]pkgobservability.Operation(nil), blueprint.operations...)
}
