package composition

import (
	"context"
	"fmt"

	"github.com/reina0721/clouddrive/internal/module/navigation/model"
	navigationservice "github.com/reina0721/clouddrive/internal/module/navigation/service"
	webuicontract "github.com/reina0721/clouddrive/internal/webui"
)

// navigationCatalogAdapter 只把静态菜单定义与策略校验暴露给 Navigation。
type navigationCatalogAdapter struct{ catalog webuicontract.Catalog }

func newNavigationCatalogAdapter(catalog webuicontract.Catalog) (navigationservice.NavigationCatalog, error) {
	if catalog.Revision == "" {
		return nil, fmt.Errorf("navigation WebUI catalog is empty")
	}
	return navigationCatalogAdapter{catalog: catalog}, nil
}
func (adapter navigationCatalogAdapter) Snapshot() navigationservice.CatalogSnapshot {
	result := navigationservice.CatalogSnapshot{Revision: adapter.catalog.Revision}
	for _, binding := range adapter.catalog.Bindings {
		for _, item := range binding.Navigation {
			manageable := false
			for _, route := range binding.Routes {
				if route.ID == item.RouteID {
					manageable = route.DeliveryState == webuicontract.DeliveryImplemented
					break
				}
			}
			result.Definitions = append(result.Definitions, model.Definition{ID: item.ID, ModuleID: binding.ModuleID, RouteID: item.RouteID, TitleMessageID: item.TitleMessageID, IconID: item.IconID, DefaultParentID: item.ParentID, DefaultOrder: model.Order(item.Order), Manageable: manageable})
		}
	}
	return result
}
func (adapter navigationCatalogAdapter) Validate(snapshot navigationservice.CatalogSnapshot, policies []model.Policy) (string, error) {
	if snapshot.Revision != adapter.catalog.Revision {
		return "", model.ErrCatalogChanged
	}
	overrides := make([]webuicontract.NavigationPolicy, len(policies))
	for index, policy := range policies {
		overrides[index] = webuicontract.NavigationPolicy{NavigationID: policy.NavigationID, Enabled: policy.Enabled, ParentOverride: policy.ParentOverride, OrderOverride: webUIOrder(policy.OrderOverride)}
	}
	projected, err := webuicontract.BuildNavigationPolicySnapshot(adapter.catalog, overrides...)
	if err != nil {
		return "", fmt.Errorf("validate navigation policy: %w", err)
	}
	return projected.Revision, nil
}

func navigationPolicyProvider(service *navigationservice.Service, catalog webuicontract.Catalog) func(context.Context) (webuicontract.NavigationPolicySnapshot, error) {
	return func(ctx context.Context) (webuicontract.NavigationPolicySnapshot, error) {
		snapshot, err := service.Snapshot(ctx)
		if err != nil {
			return webuicontract.NavigationPolicySnapshot{}, err
		}
		if snapshot.CatalogRevision != catalog.Revision {
			return webuicontract.NavigationPolicySnapshot{}, model.ErrCatalogChanged
		}
		overrides := make([]webuicontract.NavigationPolicy, len(snapshot.Policies))
		for index, policy := range snapshot.Policies {
			overrides[index] = webuicontract.NavigationPolicy{NavigationID: policy.NavigationID, Enabled: policy.Enabled, ParentOverride: policy.ParentOverride, OrderOverride: webUIOrder(policy.OrderOverride)}
		}
		projected, err := webuicontract.BuildNavigationPolicySnapshot(catalog, overrides...)
		if err != nil {
			return webuicontract.NavigationPolicySnapshot{}, err
		}
		if projected.Revision != snapshot.NavigationRevision {
			return webuicontract.NavigationPolicySnapshot{}, fmt.Errorf("navigation revision mismatch")
		}
		return projected, nil
	}
}

var _ navigationservice.NavigationCatalog = navigationCatalogAdapter{}

func webUIOrder(value *model.Order) *int {
	if value == nil {
		return nil
	}
	converted := int(*value)
	return &converted
}
