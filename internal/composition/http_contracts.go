package composition

import (
	authhttp "github.com/reina0721/clouddrive/internal/module/auth/binding/http"
	authpermission "github.com/reina0721/clouddrive/internal/module/auth/binding/permission"
	authwebui "github.com/reina0721/clouddrive/internal/module/auth/binding/webui"
	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	"github.com/reina0721/clouddrive/internal/module/console"
	iamhttp "github.com/reina0721/clouddrive/internal/module/iam/binding/http"
	iampermission "github.com/reina0721/clouddrive/internal/module/iam/binding/permission"
	iamwebui "github.com/reina0721/clouddrive/internal/module/iam/binding/webui"
	navigationhttp "github.com/reina0721/clouddrive/internal/module/navigation/binding/http"
	navigationpermission "github.com/reina0721/clouddrive/internal/module/navigation/binding/permission"
	navigationwebui "github.com/reina0721/clouddrive/internal/module/navigation/binding/webui"
	openapiwebui "github.com/reina0721/clouddrive/internal/module/openapi/binding/webui"
	opswebui "github.com/reina0721/clouddrive/internal/module/ops/binding/webui"
	organizationhttp "github.com/reina0721/clouddrive/internal/module/organization/binding/http"
	organizationpermission "github.com/reina0721/clouddrive/internal/module/organization/binding/permission"
	organizationwebui "github.com/reina0721/clouddrive/internal/module/organization/binding/webui"
	settingswebui "github.com/reina0721/clouddrive/internal/module/settings/binding/webui"
	todohttp "github.com/reina0721/clouddrive/internal/module/todo/binding/http"
	todopermission "github.com/reina0721/clouddrive/internal/module/todo/binding/permission"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	httptransport "github.com/reina0721/clouddrive/internal/transport/http"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	webuicontract "github.com/reina0721/clouddrive/internal/webui"
)

// applicationHTTPRegistrations 返回当前应用接入的全部 HTTP operation（装配汇总点）。
//
// 这是 composition 内“哪些模块提供 HTTP 公开契约”的唯一汇总：policy 汇总
// policy、observability inventory、OpenAPI 与运行时路由都从相同 registration
// 模型消费，避免静态契约与真实 handler 漂移。新增 HTTP 业务模块时在此追加一项，
// 并同时扩展 generation 中的运行时依赖装配。
func applicationHTTPRegistrations() []humabinding.Registration {
	return []humabinding.Registration{
		authhttp.HumaRegistration(nil),
		iamhttp.HumaRegistration(nil),
		organizationhttp.HumaRegistration(nil, nil),
		navigationhttp.HumaRegistration(nil, nil),
		todohttp.HumaRegistration(nil),
	}
}

func applicationHTTPCatalog() ([]humabinding.Definition, error) {
	return httptransport.BuildHumaOperationCatalog(applicationHTTPRegistrations()...)
}

// applicationPermissionCatalog 是当前应用中“哪些模块贡献权限定义”的唯一显式汇总点。
func applicationPermissionCatalog() (permissioncatalog.Catalog, error) {
	definitions := append(authpermission.Definitions(), iampermission.Definitions()...)
	definitions = append(definitions, organizationpermission.Definitions()...)
	definitions = append(definitions, navigationpermission.Definitions()...)
	definitions = append(definitions, todopermission.Definitions()...)
	definitions = append(definitions, console.Permissions()...)
	return permissioncatalog.BuildCatalog(definitions...)
}

// applicationWebUIModules 是 WebUI runtime 与前端生成器共享的唯一 registration 汇总点。
// 新模块必须在这里显式选择并声明 Activation；目录存在不代表应用会发布它。
func applicationWebUIModules() []webuicontract.ModuleRegistration {
	return []webuicontract.ModuleRegistration{
		{Binding: iamwebui.Binding(), Activation: webuicontract.ActivationEnabled},
		{Binding: organizationwebui.Binding(), Activation: webuicontract.ActivationEnabled},
		{Binding: navigationwebui.Binding(), Activation: webuicontract.ActivationEnabled},
		{Binding: opswebui.Binding(), Activation: webuicontract.ActivationEnabled},
		{Binding: authwebui.Binding(), Activation: webuicontract.ActivationEnabled},
		{Binding: settingswebui.Binding(), Activation: webuicontract.ActivationEnabled},
		{Binding: openapiwebui.Binding(), Activation: webuicontract.ActivationEnabled},
	}
}

func applicationWebUISDKInventory() webuicontract.SDKInventory {
	return webuicontract.SDKInventory{
		"runtime": 1,
		"http":    1,
		"i18n":    1,
		"query":   1,
		"ui":      1,
		"mock":    1,
		"zone":    1,
	}
}

// applicationWebUIAvailability 是当前应用的通用 availability provider。
// 真实外部依赖接入时由 composition 提供 route capability 快照；没有快照不能在 handler 内猜测为可用。
func applicationWebUIAvailability(string) webuicontract.Availability {
	return webuicontract.Availability{State: webuicontract.AvailabilityAvailable}
}

// applicationWebUICatalog 是 WebUI runtime 与前端生成器共享的唯一声明汇总点。
func applicationWebUICatalog() (webuicontract.Catalog, error) {
	blueprint, err := newApplicationBlueprint()
	if err != nil {
		return webuicontract.Catalog{}, err
	}
	return blueprint.webuiCatalog, nil
}

func buildApplicationWebUICatalog(definitions []humabinding.Definition, permissions permissioncatalog.Catalog, policies []authmodel.Policy) (webuicontract.Catalog, error) {
	registrations := applicationWebUIModules()
	catalog, err := webuicontract.BuildApplicationCatalog(registrations, applicationWebUISDKInventory())
	if err != nil {
		return webuicontract.Catalog{}, err
	}
	operations := make(map[string]struct{}, len(definitions))
	for _, operation := range definitions {
		operations[operation.ID] = struct{}{}
	}
	operations["ops.diagnostics"] = struct{}{}
	operations["ops.metrics"] = struct{}{}
	if err := catalog.ValidateOperationReferences(operations); err != nil {
		return webuicontract.Catalog{}, err
	}
	policyByOperation := make(map[string]authmodel.Policy, len(policies))
	references := make([]permissioncatalog.Reference, 0, len(policies)+len(catalog.Bindings))
	for _, policy := range policies {
		policyByOperation[policy.Operation] = policy
		if policy.Mode == authmodel.PolicyProtected {
			references = append(references, permissioncatalog.Reference{Key: permissioncatalog.Key(policy.Scope), ConsumerType: "operation", ConsumerID: policy.Operation})
		}
	}
	for _, binding := range catalog.Bindings {
		for _, route := range binding.Routes {
			if route.ViewOperationID == "" {
				continue
			}
			policy := policyByOperation[route.ViewOperationID]
			if policy.Mode == authmodel.PolicyProtected {
				references = append(references, permissioncatalog.Reference{Key: permissioncatalog.Key(policy.Scope), ConsumerType: "webui route", ConsumerID: route.ID})
			}
		}
	}
	if err := permissions.ValidateReferences(references...); err != nil {
		return webuicontract.Catalog{}, err
	}
	return catalog, nil
}
