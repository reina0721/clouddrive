package webui

import (
	"encoding/json"
	"strings"
	"testing"
)

func testBinding(moduleID string, defaultRoute bool) Binding {
	return Binding{
		ModuleID:   moduleID,
		Entries:    []Entry{{ID: moduleID + ".page", SourcePath: "web/Page.tsx"}},
		Routes:     []Route{{ID: moduleID + ".page", Path: "/" + moduleID, EntryID: moduleID + ".page", TitleMessageID: moduleID + ".title", Layout: RouteLayoutApp, DeliveryState: DeliveryImplemented, Default: defaultRoute}},
		Navigation: []Navigation{{ID: moduleID + ".page", RouteID: moduleID + ".page", TitleMessageID: moduleID + ".title", IconID: "menu"}},
		Locales:    []Locale{{Language: "zh-CN", Namespace: moduleID, SourcePath: "web/zh-CN.json"}},
		MockSource: "web/mock.ts",
	}
}

func TestBuildCatalogIsDeterministicAndManifestOmitsSourcePath(t *testing.T) {
	left, err := BuildCatalog(testBinding("ops", true), testBinding("auth", false))
	if err != nil {
		t.Fatal(err)
	}
	right, err := BuildCatalog(testBinding("auth", false), testBinding("ops", true))
	if err != nil {
		t.Fatal(err)
	}
	if left.Revision != right.Revision {
		t.Fatalf("revision differs: %s != %s", left.Revision, right.Revision)
	}
	manifest := left.ManifestFor(func(string) Access { return AccessAllowed })
	encoded, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "SourcePath") || strings.Contains(string(encoded), "Page.tsx") {
		t.Fatalf("manifest leaked source path: %s", encoded)
	}
	if strings.Contains(string(encoded), `"state"`) || !strings.Contains(string(encoded), `"deliveryState":"implemented"`) {
		t.Fatalf("manifest did not use the single delivery state contract: %s", encoded)
	}
}

func TestBuildCatalogRejectsAmbiguousRoutesAndLocales(t *testing.T) {
	first := testBinding("ops", true)
	second := testBinding("auth", true)
	if _, err := BuildCatalog(first, second); err == nil {
		t.Fatal("multiple global default routes were accepted")
	}

	invalidDelivery := testBinding("ops", true)
	invalidDelivery.Routes[0].DeliveryState = DeliveryState("preview")
	if _, err := BuildCatalog(invalidDelivery); err == nil {
		t.Fatal("unsupported delivery state was accepted")
	}

	duplicateLocale := testBinding("ops", true)
	duplicateLocale.Locales = append(duplicateLocale.Locales, duplicateLocale.Locales[0])
	if _, err := BuildCatalog(duplicateLocale); err == nil {
		t.Fatal("duplicate language and namespace were accepted")
	}
}

func TestBuildCatalogRejectsBrokenReferencesAndCycles(t *testing.T) {
	broken := testBinding("ops", true)
	broken.Routes[0].EntryID = "missing"
	if _, err := BuildCatalog(broken); err == nil {
		t.Fatal("missing entry was accepted")
	}
	cycle := testBinding("ops", true)
	cycle.Navigation[0].ParentID = cycle.Navigation[0].ID
	if _, err := BuildCatalog(cycle); err == nil {
		t.Fatal("navigation cycle was accepted")
	}
}

func TestBuildCatalogAllowsCrossOwnerParentReferencesAndRejectsUnknownParent(t *testing.T) {
	// 070：ParentID 可引用其他模块的 navigation（双向归属）——与声明顺序无关。
	parent := testBinding("iam", true)
	parent.Navigation[0].ID = "iam.access"
	child := testBinding("settings", false)
	child.Navigation[0].ID = "settings.entry"
	child.Navigation[0].ParentID = "iam.access"
	if _, err := BuildCatalog(child, parent); err != nil {
		t.Fatalf("cross-owner parent reference was rejected: %v", err)
	}
	if _, err := BuildCatalog(parent, child); err != nil {
		t.Fatalf("cross-owner parent reference depends on declaration order: %v", err)
	}

	unknown := testBinding("settings", false)
	unknown.Navigation[0].ParentID = "missing.parent"
	if _, err := BuildCatalog(unknown); err == nil {
		t.Fatal("unknown parent reference was accepted")
	}
}

func TestBuildCatalogRequiresLocaleForWebUIEntries(t *testing.T) {
	binding := testBinding("ops", true)
	binding.Locales = nil
	if _, err := BuildCatalog(binding); err == nil {
		t.Fatal("webui entries without a locale binding were accepted")
	}
}

func TestBuildCatalogRequiresMockSourceForWebUIEntries(t *testing.T) {
	binding := testBinding("ops", true)
	binding.MockSource = ""
	if _, err := BuildCatalog(binding); err == nil {
		t.Fatal("webui entries without a mock source were accepted")
	}
	invalid := testBinding("ops", true)
	invalid.MockSource = "mock.js"
	if _, err := BuildCatalog(invalid); err == nil {
		t.Fatal("mock source with unsupported extension was accepted")
	}
}

func TestCatalogValidatesOperationInventory(t *testing.T) {
	binding := testBinding("ops", true)
	binding.Routes[0].ViewOperationID = "missing"
	catalog, err := BuildCatalog(binding)
	if err != nil {
		t.Fatal(err)
	}
	if err := catalog.ValidateOperationReferences(map[string]struct{}{"known": {}}); err == nil {
		t.Fatal("unknown operation was accepted")
	}
}

func TestBuildApplicationCatalogProjectsActivationAndDelivery(t *testing.T) {
	implemented := testBinding("ops", true)
	notImplemented := testBinding("future", false)
	notImplemented.Routes[0].DeliveryState = DeliveryNotImplemented
	disabled := testBinding("disabled", false)
	catalog, err := BuildApplicationCatalog([]ModuleRegistration{
		{Binding: implemented, Activation: ActivationEnabled},
		{Binding: notImplemented, Activation: ActivationEnabled},
		{Binding: disabled, Activation: ActivationDisabled},
	}, SDKInventory{})
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog.Bindings) != 1 {
		t.Fatalf("unexpected deployable bindings: %#v", catalog.Bindings)
	}
	for _, binding := range catalog.Bindings {
		if binding.ModuleID == "disabled" {
			t.Fatalf("disabled binding leaked into catalog: %#v", binding)
		}
	}
	if _, err := BuildApplicationCatalog([]ModuleRegistration{{Binding: implemented}}, SDKInventory{}); err == nil {
		t.Fatal("missing activation was accepted")
	}
}

func TestManifestAvailabilityFailsClosedAndFiltersNavigation(t *testing.T) {
	binding := testBinding("ops", true)
	binding.Routes[0].DegradedCapabilities = []string{"read-only"}
	catalog, err := BuildCatalog(binding)
	if err != nil {
		t.Fatal(err)
	}
	manifest := catalog.ManifestForWithAvailability(
		func(string) Access { return AccessAllowed },
		func(routeID string) Availability {
			if routeID == "ops.page" {
				return Availability{State: AvailabilityDegraded, Capabilities: []string{"read-only"}}
			}
			return Availability{State: AvailabilityState("unknown")}
		},
	)
	if len(manifest.Routes) != 1 || manifest.Routes[0].Availability != AvailabilityDegraded {
		t.Fatalf("degraded route was not represented: %#v", manifest.Routes)
	}
	if len(manifest.Menu) != 1 {
		t.Fatalf("supported degraded route should remain navigable: %#v", manifest.Menu)
	}
	unknown := catalog.ManifestForWithAvailability(func(string) Access { return AccessAllowed }, func(string) Availability { return Availability{} })
	if unknown.Routes[0].Availability != AvailabilityUnavailable || len(unknown.Menu) != 0 {
		t.Fatalf("unknown availability did not fail closed: %#v", unknown)
	}
}

func TestBuildApplicationCatalogRejectsSDKRequirementMismatch(t *testing.T) {
	binding := testBinding("ops", true)
	binding.Requires = []SDKRequirement{{ID: "runtime", MajorVersion: 2}}
	if _, err := BuildApplicationCatalog([]ModuleRegistration{{Binding: binding, Activation: ActivationEnabled}}, SDKInventory{"runtime": 1}); err == nil {
		t.Fatal("SDK major mismatch was accepted")
	}
}

func TestDefaultNavigationPolicyMatchesStaticCatalogAndUsesDualRevisions(t *testing.T) {
	binding := testBinding("ops", true)
	binding.Navigation[0].Order = 20
	catalog, err := BuildCatalog(binding)
	if err != nil {
		t.Fatal(err)
	}
	policy, err := BuildNavigationPolicySnapshot(catalog)
	if err != nil {
		t.Fatal(err)
	}
	manifest, err := catalog.ManifestForWithNavigation(policy, func(string) Access { return AccessAllowed }, func(string) Availability { return Availability{State: AvailabilityAvailable} })
	if err != nil {
		t.Fatal(err)
	}
	if manifest.CatalogRevision != catalog.Revision || manifest.NavigationRevision == "" || len(manifest.Menu) != 1 || manifest.Menu[0].Order != 20 {
		t.Fatalf("unexpected default policy manifest: %#v", manifest)
	}
	encoded, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), `"revision"`) || !strings.Contains(string(encoded), `"catalogRevision"`) || !strings.Contains(string(encoded), `"navigationRevision"`) {
		t.Fatalf("dual revisions are not explicit: %s", encoded)
	}
}

func TestNavigationPolicyOverridesOnlyMenuProjection(t *testing.T) {
	parent := testBinding("parent", true)
	child := testBinding("child", false)
	catalog, err := BuildCatalog(parent, child)
	if err != nil {
		t.Fatal(err)
	}
	root := ""
	order := 7
	policy, err := BuildNavigationPolicySnapshot(catalog,
		NavigationPolicy{NavigationID: "parent.page", Enabled: false},
		NavigationPolicy{NavigationID: "child.page", Enabled: true, ParentOverride: &root, OrderOverride: &order},
	)
	if err != nil {
		t.Fatal(err)
	}
	manifest, err := catalog.ManifestForWithNavigation(policy, func(string) Access { return AccessAllowed }, func(string) Availability { return Availability{State: AvailabilityAvailable} })
	if err != nil {
		t.Fatal(err)
	}
	if len(manifest.Routes) != 2 || len(manifest.Menu) != 1 || manifest.Menu[0].ID != "child.page" || manifest.Menu[0].ParentID != "" || manifest.Menu[0].Order != 7 {
		t.Fatalf("unexpected policy projection: %#v", manifest)
	}
	for _, route := range manifest.Routes {
		if route.ID == "child.page" && (route.Path != "/child" || route.EntryID != "child.page" || route.ModuleID != "child") {
			t.Fatalf("policy mutated immutable route fields: %#v", route)
		}
	}
}

func TestNavigationPolicyFailsClosedForInvalidOverrides(t *testing.T) {
	first := testBinding("first", true)
	second := testBinding("second", false)
	catalog, err := BuildCatalog(first, second)
	if err != nil {
		t.Fatal(err)
	}
	firstParent, secondParent := "second.page", "first.page"
	badOrder := maximumNavigationOrder + 1
	for _, test := range []struct {
		name      string
		overrides []NavigationPolicy
	}{
		{name: "unknown", overrides: []NavigationPolicy{{NavigationID: "missing", Enabled: true}}},
		{name: "duplicate", overrides: []NavigationPolicy{{NavigationID: "first.page", Enabled: true}, {NavigationID: "first.page", Enabled: false}}},
		{name: "cycle", overrides: []NavigationPolicy{{NavigationID: "first.page", Enabled: true, ParentOverride: &firstParent}, {NavigationID: "second.page", Enabled: true, ParentOverride: &secondParent}}},
		{name: "order", overrides: []NavigationPolicy{{NavigationID: "first.page", Enabled: true, OrderOverride: &badOrder}}},
	} {
		t.Run(test.name, func(t *testing.T) {
			if _, err := BuildNavigationPolicySnapshot(catalog, test.overrides...); err == nil {
				t.Fatal("invalid navigation policy was accepted")
			}
		})
	}
}

func TestDisabledNavigationParentHidesDescendants(t *testing.T) {
	parent := testBinding("parent", true)
	child := testBinding("child", false)
	catalog, err := BuildCatalog(parent, child)
	if err != nil {
		t.Fatal(err)
	}
	parentID := "parent.page"
	policy, err := BuildNavigationPolicySnapshot(catalog,
		NavigationPolicy{NavigationID: "parent.page", Enabled: false},
		NavigationPolicy{NavigationID: "child.page", Enabled: true, ParentOverride: &parentID},
	)
	if err != nil {
		t.Fatal(err)
	}
	manifest, err := catalog.ManifestForWithNavigation(policy, func(string) Access { return AccessAllowed }, func(string) Availability { return Availability{State: AvailabilityAvailable} })
	if err != nil {
		t.Fatal(err)
	}
	if len(manifest.Routes) != 2 || len(manifest.Menu) != 0 {
		t.Fatalf("disabled parent leaked descendant menu or removed routes: %#v", manifest)
	}
}

func TestApplicationCatalogFixtureStateMatrix(t *testing.T) {
	fixture := testBinding("fixture", false)
	fixture.Routes[0].DegradedCapabilities = []string{"diagnostics"}
	fixture.Routes[0].ViewOperationID = "fixture.view"
	fixture.Requires = []SDKRequirement{{ID: "runtime", MajorVersion: 1}}

	cases := []struct {
		name       string
		activation ActivationState
		delivery   DeliveryState
		access     Access
		available  Availability
		wantRoute  bool
		wantMenu   bool
	}{
		{name: "enabled available", activation: ActivationEnabled, delivery: DeliveryImplemented, access: AccessAllowed, available: Availability{State: AvailabilityAvailable}, wantRoute: true, wantMenu: true},
		{name: "disabled", activation: ActivationDisabled, delivery: DeliveryImplemented, access: AccessAllowed, available: Availability{State: AvailabilityAvailable}},
		{name: "not implemented", activation: ActivationEnabled, delivery: DeliveryNotImplemented, access: AccessAllowed, available: Availability{State: AvailabilityAvailable}},
		{name: "denied", activation: ActivationEnabled, delivery: DeliveryImplemented, access: AccessDenied, available: Availability{State: AvailabilityAvailable}, wantRoute: true},
		{name: "unavailable", activation: ActivationEnabled, delivery: DeliveryImplemented, access: AccessAllowed, available: Availability{State: AvailabilityUnavailable}, wantRoute: true},
		{name: "supported degraded", activation: ActivationEnabled, delivery: DeliveryImplemented, access: AccessAllowed, available: Availability{State: AvailabilityDegraded, Capabilities: []string{"diagnostics"}}, wantRoute: true, wantMenu: true},
		{name: "unsupported degraded", activation: ActivationEnabled, delivery: DeliveryImplemented, access: AccessAllowed, available: Availability{State: AvailabilityDegraded}, wantRoute: true},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			binding := fixture
			binding.Routes = append([]Route(nil), fixture.Routes...)
			binding.Routes[0].DeliveryState = testCase.delivery
			catalog, err := BuildApplicationCatalog([]ModuleRegistration{{Binding: binding, Activation: testCase.activation}}, SDKInventory{"runtime": 1})
			if err != nil {
				t.Fatal(err)
			}
			manifest := catalog.ManifestForWithAvailability(func(string) Access { return testCase.access }, func(string) Availability { return testCase.available })
			if got := len(manifest.Routes) > 0; got != testCase.wantRoute {
				t.Fatalf("route projection = %v, want %v: %#v", got, testCase.wantRoute, manifest)
			}
			if got := len(manifest.Menu) > 0; got != testCase.wantMenu {
				t.Fatalf("menu projection = %v, want %v: %#v", got, testCase.wantMenu, manifest)
			}
		})
	}
}

// zoneTestBinding 在 testBinding 基础上声明一个分区注入点与其专属 entry。
func zoneTestBinding(moduleID string, defaultRoute bool) Binding {
	binding := testBinding(moduleID, defaultRoute)
	binding.Entries = append(binding.Entries, Entry{ID: moduleID + ".header", SourcePath: "web/Header.tsx"})
	binding.HeaderActions = []HeaderAction{{
		ZoneContributionBase: ZoneContributionBase{
			ID: moduleID + ".global", EntryID: moduleID + ".header",
			TitleMessageID: moduleID + ".header.title", OperationID: moduleID + ".action", Order: 10,
		},
		IconID: "settings",
	}}
	return binding
}

func TestManifestProjectsZonesWithAccessAndAvailabilityGates(t *testing.T) {
	binding := zoneTestBinding("ops", true)
	catalog, err := BuildCatalog(binding)
	if err != nil {
		t.Fatal(err)
	}
	manifest := catalog.ManifestForWithAvailability(
		func(operation string) Access {
			if operation == "ops.action" {
				return AccessAllowed
			}
			return AccessDenied
		},
		func(zoneID string) Availability {
			if zoneID == "ops.global" {
				return Availability{State: AvailabilityAvailable}
			}
			return Availability{State: AvailabilityUnavailable}
		},
	)
	if len(manifest.Zones) != 1 {
		t.Fatalf("unexpected zone projection: %#v", manifest.Zones)
	}
	zone := manifest.Zones[0]
	if zone.Zone != ZoneHeaderActions || zone.ID != "ops.global" || zone.EntryID != "ops.header" || zone.IconID != "settings" || zone.Access != AccessAllowed || zone.ModuleID != "ops" {
		t.Fatalf("unexpected projected zone: %#v", zone)
	}
}

func TestManifestZoneGatesFailsClosed(t *testing.T) {
	binding := zoneTestBinding("ops", true)
	binding.SidebarPanels = []SidebarPanel{{
		ZoneContributionBase: ZoneContributionBase{
			ID: "ops.panel", EntryID: "ops.header", TitleMessageID: "ops.panel.title",
			OperationID: "ops.admin.action", Order: 20,
		},
		IconID: "list",
	}}
	binding.FooterStatusItems = []FooterStatusItem{{
		ZoneContributionBase: ZoneContributionBase{
			ID: "ops.status", EntryID: "ops.header", TitleMessageID: "ops.status.title", Order: 30,
		},
		Kind: FooterStatusKindStatus,
	}}
	catalog, err := BuildCatalog(binding)
	if err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		name      string
		access    func(string) Access
		available func(string) Availability
		wantZones int
	}{
		{
			name:      "denied operation hides operation-gated zones",
			access:    func(string) Access { return AccessDenied },
			available: func(string) Availability { return Availability{State: AvailabilityAvailable} },
			wantZones: 1, // 只有无 OperationID 的底部状态项不受 access 门禁影响
		},
		{
			name:      "unavailable hides every zone",
			access:    func(string) Access { return AccessAllowed },
			available: func(string) Availability { return Availability{State: AvailabilityUnavailable} },
			wantZones: 0,
		},
		{
			name:      "authentication required zone is projected for shell",
			access:    func(string) Access { return AccessAuthenticationRequired },
			available: func(string) Availability { return Availability{State: AvailabilityAvailable} },
			wantZones: 3,
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			manifest := catalog.ManifestForWithAvailability(test.access, test.available)
			if len(manifest.Zones) != test.wantZones {
				t.Fatalf("zone projection = %v, want %d: %#v", manifest.Zones, test.wantZones, manifest)
			}
		})
	}
	// 全部 allowed + available：三个注入点都投影，且无 OperationID 的项按 AccessAllowed 呈现。
	manifest := catalog.ManifestForWithAvailability(func(string) Access { return AccessAllowed }, func(string) Availability { return Availability{State: AvailabilityAvailable} })
	if len(manifest.Zones) != 3 {
		t.Fatalf("expected three projected zones: %#v", manifest.Zones)
	}
	for _, zone := range manifest.Zones {
		if zone.Access == "" || zone.Access == AccessDenied {
			t.Fatalf("projected zone carries unexpected access: %#v", zone)
		}
	}
}

func TestManifestZoneAccessAuthenticationRequiredProjection(t *testing.T) {
	binding := zoneTestBinding("ops", true)
	catalog, err := BuildCatalog(binding)
	if err != nil {
		t.Fatal(err)
	}
	manifest := catalog.ManifestForWithAvailability(
		func(operation string) Access { return AccessAuthenticationRequired },
		func(string) Availability { return Availability{State: AvailabilityAvailable} },
	)
	if len(manifest.Zones) != 1 || manifest.Zones[0].Access != AccessAuthenticationRequired {
		t.Fatalf("authentication-required zone should be projected for the authenticated shell: %#v", manifest.Zones)
	}
}

func TestBuildCatalogRejectsInvalidZoneContributions(t *testing.T) {
	duplicate := zoneTestBinding("ops", true)
	duplicate.SidebarPanels = []SidebarPanel{{
		ZoneContributionBase: ZoneContributionBase{ID: "ops.global", EntryID: "ops.header", TitleMessageID: "ops.panel.title", Order: 20},
		IconID:               "list",
	}}
	if _, err := BuildCatalog(duplicate); err == nil {
		t.Fatal("duplicate zone id was accepted")
	}
	unknownEntry := zoneTestBinding("ops", true)
	unknownEntry.HeaderActions[0].EntryID = "missing"
	if _, err := BuildCatalog(unknownEntry); err == nil {
		t.Fatal("zone referencing a foreign entry was accepted")
	}
	foreignEntry := zoneTestBinding("ops", true)
	foreignEntry.HeaderActions[0].EntryID = "auth.page"
	if _, err := BuildCatalog(foreignEntry, testBinding("auth", false)); err == nil {
		t.Fatal("zone referencing another module entry was accepted")
	}
	badIcon := zoneTestBinding("ops", true)
	badIcon.HeaderActions[0].IconID = "unicorn"
	if _, err := BuildCatalog(badIcon); err == nil {
		t.Fatal("zone with icon outside the catalog was accepted")
	}
	missingIcon := zoneTestBinding("ops", true)
	missingIcon.HeaderActions[0].IconID = ""
	if _, err := BuildCatalog(missingIcon); err == nil {
		t.Fatal("icon zone without an icon was accepted")
	}
	badKind := zoneTestBinding("ops", true)
	badKind.PageHeaderItems = []PageHeaderItem{{
		ZoneContributionBase: ZoneContributionBase{ID: "ops.pageitem", EntryID: "ops.header", TitleMessageID: "ops.pageitem.title", Order: 20},
		Kind:                 PageHeaderItemKind("hero"),
	}}
	if _, err := BuildCatalog(badKind); err == nil {
		t.Fatal("page header item with unsupported kind was accepted")
	}
	badOrder := zoneTestBinding("ops", true)
	badOrder.HeaderActions[0].Order = maximumNavigationOrder + 1
	if _, err := BuildCatalog(badOrder); err == nil {
		t.Fatal("zone order outside the supported range was accepted")
	}
	tooMany := zoneTestBinding("ops", true)
	tooMany.HeaderActions = nil
	for index := 0; index < maximumZoneContributionsPerModule+1; index++ {
		tooMany.HeaderActions = append(tooMany.HeaderActions, HeaderAction{
			ZoneContributionBase: ZoneContributionBase{
				ID: "ops.bulk" + string(rune(index+int('a'))), EntryID: "ops.header",
				TitleMessageID: "ops.bulk.title", Order: index,
			},
			IconID: "menu",
		})
	}
	if _, err := BuildCatalog(tooMany); err == nil {
		t.Fatal("zone contribution over the per-module limit was accepted")
	}
}

func TestValidateOperationReferencesRejectsUnknownZoneOperation(t *testing.T) {
	binding := zoneTestBinding("ops", true)
	catalog, err := BuildCatalog(binding)
	if err != nil {
		t.Fatal(err)
	}
	if err := catalog.ValidateOperationReferences(map[string]struct{}{"known": {}}); err == nil {
		t.Fatal("unknown zone operation was accepted")
	}
}

func TestBuildCatalogRejectsNavigationIconOutsideCatalog(t *testing.T) {
	binding := testBinding("ops", true)
	binding.Navigation[0].IconID = "unicorn"
	if _, err := BuildCatalog(binding); err == nil {
		t.Fatal("navigation icon outside the catalog was accepted")
	}
}

func TestManifestActionPermissionsProjectStrictestAccess(t *testing.T) {
	binding := zoneTestBinding("ops", true)
	binding.HeaderActions[0].OperationID = "ops.shared"
	binding.SidebarPanels = []SidebarPanel{{
		ZoneContributionBase: ZoneContributionBase{ID: "ops.panel", EntryID: "ops.header", TitleMessageID: "ops.panel.title", OperationID: "ops.shared", Order: 20},
		IconID:               "list",
	}}
	binding.ActionPermissions = []ActionPermission{{OperationID: "ops.pageonly"}}
	catalog, err := BuildCatalog(binding)
	if err != nil {
		t.Fatal(err)
	}
	// ops.shared 同时由两个 zone 引用；从严语义取最严格 access。
	manifest := catalog.ManifestForWithAvailability(func(operation string) Access {
		switch operation {
		case "ops.shared", "ops.pageonly":
			return AccessDenied
		}
		return AccessAllowed
	}, func(string) Availability { return Availability{State: AvailabilityAvailable} })
	// denied 动作不投影 zone，但 actionPermissions 必须保留该动作的 denied 判定。
	if len(manifest.Zones) != 0 {
		t.Fatalf("denied zone should not be projected: %#v", manifest.Zones)
	}
	byOperation := map[string]Access{}
	for _, permission := range manifest.ActionPermissions {
		byOperation[permission.OperationID] = permission.Access
	}
	if byOperation["ops.shared"] != AccessDenied {
		t.Fatalf("ops.shared should be denied in action permissions: %#v", manifest.ActionPermissions)
	}
	if byOperation["ops.pageonly"] != AccessDenied {
		t.Fatalf("page-only action should be denied: %#v", manifest.ActionPermissions)
	}
	// 从严：allowed 与 denied 并存时取 denied。
	manifest = catalog.ManifestForWithAvailability(func(operation string) Access {
		switch operation {
		case "ops.pageonly":
			return AccessDenied
		}
		return AccessAllowed
	}, func(string) Availability { return Availability{State: AvailabilityAvailable} })
	if len(manifest.Zones) != 2 {
		t.Fatalf("allowed zones should be projected: %#v", manifest.Zones)
	}
	byOperation = map[string]Access{}
	for _, permission := range manifest.ActionPermissions {
		byOperation[permission.OperationID] = permission.Access
	}
	if byOperation["ops.pageonly"] != AccessDenied || byOperation["ops.shared"] != AccessAllowed {
		t.Fatalf("action permissions violate strictest-wins: %#v", manifest.ActionPermissions)
	}
	// 排序稳定。
	previous := ""
	for _, permission := range manifest.ActionPermissions {
		if permission.OperationID <= previous {
			t.Fatalf("action permissions are not sorted: %#v", manifest.ActionPermissions)
		}
		previous = permission.OperationID
	}
}

func TestValidateOperationReferencesRejectsUnknownActionPermission(t *testing.T) {
	binding := zoneTestBinding("ops", true)
	binding.ActionPermissions = []ActionPermission{{OperationID: "missing"}}
	catalog, err := BuildCatalog(binding)
	if err != nil {
		t.Fatal(err)
	}
	if err := catalog.ValidateOperationReferences(map[string]struct{}{"known": {}}); err == nil {
		t.Fatal("unknown action permission was accepted")
	}
}

func TestBuildCatalogRejectsDuplicateActionPermission(t *testing.T) {
	binding := zoneTestBinding("ops", true)
	binding.ActionPermissions = []ActionPermission{{OperationID: "ops.action"}, {OperationID: "ops.action"}}
	if _, err := BuildCatalog(binding); err == nil {
		t.Fatal("duplicate action permission was accepted")
	}
}

func TestProjectApplicationCatalogDropsZonesOfNotImplementedModule(t *testing.T) {
	notImplemented := zoneTestBinding("future", false)
	notImplemented.Routes[0].DeliveryState = DeliveryNotImplemented
	catalog, err := BuildApplicationCatalog([]ModuleRegistration{
		{Binding: notImplemented, Activation: ActivationEnabled},
	}, SDKInventory{})
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog.Bindings) != 0 {
		t.Fatalf("module with only not-implemented routes leaked into catalog: %#v", catalog.Bindings)
	}
	// 已实现模块的 zone entry 必须保留在投影 catalog 中。
	implemented := zoneTestBinding("ops", true)
	catalog, err = BuildApplicationCatalog([]ModuleRegistration{
		{Binding: implemented, Activation: ActivationEnabled},
	}, SDKInventory{})
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog.Bindings) != 1 || len(catalog.Bindings[0].HeaderActions) != 1 {
		t.Fatalf("implemented module zone was dropped: %#v", catalog.Bindings)
	}
	entryFound := false
	for _, entry := range catalog.Bindings[0].Entries {
		if entry.ID == "ops.header" {
			entryFound = true
		}
	}
	if !entryFound {
		t.Fatalf("zone entry was dropped from projected catalog: %#v", catalog.Bindings[0].Entries)
	}
}

func TestManifestZoneOrderingIsStable(t *testing.T) {
	binding := zoneTestBinding("ops", true)
	binding.HeaderActions = append(binding.HeaderActions,
		HeaderAction{ZoneContributionBase: ZoneContributionBase{ID: "ops.b", EntryID: "ops.header", TitleMessageID: "ops.b.title", Order: 5}, IconID: "menu"},
		HeaderAction{ZoneContributionBase: ZoneContributionBase{ID: "ops.a", EntryID: "ops.header", TitleMessageID: "ops.a.title", Order: 5}, IconID: "menu"},
	)
	binding.FooterStatusItems = []FooterStatusItem{{ZoneContributionBase: ZoneContributionBase{ID: "ops.status", EntryID: "ops.header", TitleMessageID: "ops.status.title", Order: 1}, Kind: FooterStatusKindStatus}}
	catalog, err := BuildCatalog(binding)
	if err != nil {
		t.Fatal(err)
	}
	manifest := catalog.ManifestForWithAvailability(func(string) Access { return AccessAllowed }, func(string) Availability { return Availability{State: AvailabilityAvailable} })
	want := []string{"header-actions", "header-actions", "header-actions", "footer-status"}
	if len(manifest.Zones) != len(want) {
		t.Fatalf("unexpected zone count: %#v", manifest.Zones)
	}
	for index, zone := range manifest.Zones {
		if string(zone.Zone) != want[index] {
			t.Fatalf("zones are not ordered by skeleton layout rank: %#v", manifest.Zones)
		}
	}
	if manifest.Zones[0].ID != "ops.a" || manifest.Zones[1].ID != "ops.b" || manifest.Zones[2].ID != "ops.global" {
		t.Fatalf("zones are not ordered by id within the same order: %#v", manifest.Zones)
	}
}

// workspaceTestBinding 在 testBinding 基础上声明 workspace 资格，便于测试
// 校验与 manifest 投影的契约边界（087 恢复 085 Rev.1 的 opt-in 模型）。
func workspaceTestBinding(moduleID string, policy WorkspaceTabPolicy) Binding {
	binding := testBinding(moduleID, false)
	binding.Routes[0].WorkspaceTab = policy
	return binding
}

// TestManifestRoutesProjectWorkspaceTabPolicy 属于 087：标签资格由 route 显式声明，
// disabled/零值在 manifest 中省略（前端按 disabled 处理），singleton/contextual 只
// 在显式 opt-in 时投影。该测试守护契约面不再出现"所有正式路由自动判定"的残留。
func TestManifestRoutesProjectWorkspaceTabPolicy(t *testing.T) {
	disabled := workspaceTestBinding("plain", WorkspaceTabPolicy{})
	disabled.Routes[0].Default = true
	singleton := workspaceTestBinding("workspace", WorkspaceTabPolicy{Mode: WorkspaceTabSingleton, Restorable: true})
	contextual := workspaceTestBinding("docs", WorkspaceTabPolicy{Mode: WorkspaceTabContextual, Restorable: false})
	catalog, err := BuildCatalog(disabled, singleton, contextual)
	if err != nil {
		t.Fatal(err)
	}
	manifest := catalog.ManifestFor(func(string) Access { return AccessAllowed })
	if len(manifest.Routes) != 3 {
		t.Fatalf("unexpected route count: %#v", manifest.Routes)
	}
	for _, route := range manifest.Routes {
		switch route.ID {
		case "plain.page":
			if route.WorkspaceTab != nil {
				t.Fatalf("disabled/zero policy leaked into manifest: %#v", route.WorkspaceTab)
			}
		case "workspace.page":
			if route.WorkspaceTab == nil || route.WorkspaceTab.Mode != WorkspaceTabSingleton || !route.WorkspaceTab.Restorable {
				t.Fatalf("singleton policy projected incorrectly: %#v", route.WorkspaceTab)
			}
		case "docs.page":
			if route.WorkspaceTab == nil || route.WorkspaceTab.Mode != WorkspaceTabContextual || route.WorkspaceTab.Restorable {
				t.Fatalf("contextual policy projected incorrectly: %#v", route.WorkspaceTab)
			}
		}
	}
	encoded, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(encoded), `"workspaceTab":{"mode":"singleton","restorable":true}`) {
		t.Fatalf("manifest JSON misses singleton workspace tab projection: %s", encoded)
	}
	if strings.Contains(string(encoded), `"mode":"disabled"`) {
		t.Fatalf("manifest JSON should omit disabled workspace tab policies: %s", encoded)
	}
}

// TestWorkspaceTabPolicyValidationFailsClosed 属于 087：未知 mode 拒绝、blank/default
// 路由不得 opt-in；零值 mode 与显式 disabled 必须按 disabled 接受（不强制显式声明）。
func TestWorkspaceTabPolicyValidationFailsClosed(t *testing.T) {
	unknown := workspaceTestBinding("bad", WorkspaceTabPolicy{Mode: WorkspaceTabMode("tabs")})
	if _, err := BuildCatalog(unknown); err == nil {
		t.Fatal("unknown workspace tab mode was accepted")
	}
	blank := workspaceTestBinding("bad", WorkspaceTabPolicy{Mode: WorkspaceTabSingleton})
	blank.Routes[0].Layout = RouteLayoutBlank
	if _, err := BuildCatalog(blank); err == nil {
		t.Fatal("blank layout route opted into workspace tab was accepted")
	}
	defaultRoute := workspaceTestBinding("bad", WorkspaceTabPolicy{Mode: WorkspaceTabSingleton})
	defaultRoute.Routes[0].Default = true
	if _, err := BuildCatalog(defaultRoute); err == nil {
		t.Fatal("default route opted into workspace tab was accepted")
	}
	unauthDefault := workspaceTestBinding("bad", WorkspaceTabPolicy{Mode: WorkspaceTabContextual})
	unauthDefault.Routes[0].UnauthenticatedDefault = true
	unauthDefault.Routes[0].Layout = RouteLayoutBlank
	unauthDefault.Routes[0].ViewOperationID = ""
	if _, err := BuildCatalog(unauthDefault); err == nil {
		t.Fatal("unauthenticated default route opted into workspace tab was accepted")
	}
	// 零值 mode 必须仍被接受（显式 disabled 同语义）。
	zero := workspaceTestBinding("ok", WorkspaceTabPolicy{})
	if _, err := BuildCatalog(zero); err != nil {
		t.Fatalf("zero workspace tab policy should normalize to disabled: %v", err)
	}
	explicitDisabled := workspaceTestBinding("ok", WorkspaceTabPolicy{Mode: WorkspaceTabDisabled, Restorable: true})
	if _, err := BuildCatalog(explicitDisabled); err != nil {
		t.Fatalf("explicit disabled workspace tab policy was rejected: %v", err)
	}
}
