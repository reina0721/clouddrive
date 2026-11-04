package composition

import (
	"github.com/reina0721/clouddrive/internal/composition/httpcatalog"
	authpermission "github.com/reina0721/clouddrive/internal/module/auth/binding/permission"
	authwebui "github.com/reina0721/clouddrive/internal/module/auth/binding/webui"
	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	"github.com/reina0721/clouddrive/internal/module/console"
	filespermission "github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	iampermission "github.com/reina0721/clouddrive/internal/module/iam/binding/permission"
	iamwebui "github.com/reina0721/clouddrive/internal/module/iam/binding/webui"
	navigationpermission "github.com/reina0721/clouddrive/internal/module/navigation/binding/permission"
	navigationwebui "github.com/reina0721/clouddrive/internal/module/navigation/binding/webui"
	openapiwebui "github.com/reina0721/clouddrive/internal/module/openapi/binding/webui"
	opswebui "github.com/reina0721/clouddrive/internal/module/ops/binding/webui"
	organizationpermission "github.com/reina0721/clouddrive/internal/module/organization/binding/permission"
	organizationwebui "github.com/reina0721/clouddrive/internal/module/organization/binding/webui"
	settingswebui "github.com/reina0721/clouddrive/internal/module/settings/binding/webui"
	todopermission "github.com/reina0721/clouddrive/internal/module/todo/binding/permission"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	httptransport "github.com/reina0721/clouddrive/internal/transport/http"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	webuicontract "github.com/reina0721/clouddrive/internal/webui"
)

func applicationHTTPCatalog() ([]humabinding.Definition, error) {
	return httptransport.BuildHumaOperationCatalog(httpcatalog.Registrations()...)
}

// applicationPermissionCatalog 是当前应用中“哪些模块贡献权限定义”的唯一显式汇总点。
func applicationPermissionCatalog() (permissioncatalog.Catalog, error) {
	definitions := append(authpermission.Definitions(), iampermission.Definitions()...)
	definitions = append(definitions, organizationpermission.Definitions()...)
	definitions = append(definitions, navigationpermission.Definitions()...)
	definitions = append(definitions, todopermission.Definitions()...)
	definitions = append(definitions, console.Permissions()...)
	definitions = append(definitions, filespermission.Definitions()...)
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
