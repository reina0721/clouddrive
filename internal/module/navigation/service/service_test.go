package service_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"
	"time"

	migrationbinding "github.com/reina0721/clouddrive/internal/module/navigation/binding/migration"
	"github.com/reina0721/clouddrive/internal/module/navigation/model"
	"github.com/reina0721/clouddrive/internal/module/navigation/repo"
	"github.com/reina0721/clouddrive/internal/module/navigation/service"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
)

func TestDefaultsUpdateRevisionAndCycleRollback(t *testing.T) {
	catalog := &fakeCatalog{snapshot: service.CatalogSnapshot{Revision: "catalog-a", Definitions: []model.Definition{{ID: "root", ModuleID: "ops", RouteID: "root", DefaultOrder: 10, Manageable: true}, {ID: "child", ModuleID: "ops", RouteID: "child", DefaultParentID: "root", DefaultOrder: 20, Manageable: true}}}}
	navigation, resource := newService(t, catalog)
	defer resource.Close()
	menus, err := navigation.Menus(t.Context())
	if err != nil || len(menus) != 2 || menus[0].ID != "root" || menus[1].ParentID != "root" {
		t.Fatalf("defaults = %#v, %v", menus, err)
	}
	before, err := navigation.Snapshot(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	order := 5
	updated, err := navigation.Update(t.Context(), service.UpdateCommand{NavigationID: "child", Enabled: false, OrderOverride: &order})
	if err != nil {
		t.Fatal(err)
	}
	if before.NavigationRevision == updated.NavigationRevision {
		t.Fatal("policy mutation did not change revision")
	}
	parent := "child"
	if _, err := navigation.Update(t.Context(), service.UpdateCommand{NavigationID: "root", Enabled: true, ParentOverride: &parent}); !errors.Is(err, model.ErrCycle) {
		t.Fatalf("cycle error = %v", err)
	}
	after, err := navigation.Menus(t.Context())
	rootParent := "missing"
	childOrderOverridden := false
	for _, menu := range after {
		if menu.ID == "root" {
			rootParent = menu.ParentID
		}
		if menu.ID == "child" {
			childOrderOverridden = menu.OrderOverridden && !menu.ParentOverridden
		}
	}
	if err != nil || rootParent != "" || !childOrderOverridden {
		t.Fatalf("cycle left partial state: %#v, %v", after, err)
	}
}

func TestUnknownAndCatalogChangeFailClosed(t *testing.T) {
	catalog := &fakeCatalog{snapshot: service.CatalogSnapshot{Revision: "catalog-a", Definitions: []model.Definition{{ID: "root", Manageable: true}, {ID: "draft", Manageable: false}}}}
	navigation, resource := newService(t, catalog)
	defer resource.Close()
	if _, err := navigation.Update(t.Context(), service.UpdateCommand{NavigationID: "missing", Enabled: true}); !errors.Is(err, model.ErrUnknown) {
		t.Fatalf("unknown error = %v", err)
	}
	if _, err := navigation.Update(t.Context(), service.UpdateCommand{NavigationID: "draft", Enabled: true}); !errors.Is(err, model.ErrNotManageable) {
		t.Fatalf("not manageable error = %v", err)
	}
	if _, err := navigation.Update(t.Context(), service.UpdateCommand{NavigationID: "root", Enabled: false}); err != nil {
		t.Fatal(err)
	}
	catalog.snapshot.Revision = "catalog-b"
	if err := navigation.Compatible(t.Context()); !errors.Is(err, model.ErrCatalogChanged) {
		t.Fatalf("catalog change error = %v", err)
	}
}

type fakeCatalog struct{ snapshot service.CatalogSnapshot }

func (catalog *fakeCatalog) Snapshot() service.CatalogSnapshot { return catalog.snapshot }
func (*fakeCatalog) Validate(snapshot service.CatalogSnapshot, policies []model.Policy) (string, error) {
	payload, err := json.Marshal(struct {
		Revision string
		Policies []model.Policy
	}{snapshot.Revision, policies})
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(payload)
	return hex.EncodeToString(digest[:]), nil
}
func newService(t *testing.T, catalog service.NavigationCatalog) (*service.Service, database.Resource) {
	t.Helper()
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = filepath.Join(t.TempDir(), "navigation.db")
	runner, err := dbmigrate.New(t.Context(), dbmigrate.Config{Database: config, LockTimeout: 5 * time.Second}, migrationbinding.Set())
	if err != nil {
		t.Fatal(err)
	}
	if err := runner.Up(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := runner.Close(); err != nil {
		t.Fatal(err)
	}
	resource, err := database.NewGORM(t.Context(), &config)
	if err != nil {
		t.Fatal(err)
	}
	store, err := repo.New(resourceAccess{resource})
	if err != nil {
		t.Fatal(err)
	}
	navigation, err := service.New(store, clock.Fixed(time.Date(2026, 8, 22, 9, 0, 0, 0, time.UTC)), catalog)
	if err != nil {
		t.Fatal(err)
	}
	return navigation, resource
}

type resourceAccess struct{ resource database.Resource }

func (access resourceAccess) Use(ctx context.Context, use func(database.Client) error) error {
	return database.Borrow(ctx, access.resource.Client(), use)
}
func (access resourceAccess) WithinTx(ctx context.Context, use func(context.Context, database.Client, database.Tx) error) error {
	return access.Use(ctx, func(client database.Client) error {
		return client.WithinTx(ctx, func(txCtx context.Context, tx database.Tx) error { return use(txCtx, client, tx) })
	})
}

type recordingOperationAudit struct {
	requests []service.OperationAuditRequest
}

func (r *recordingOperationAudit) RecordOperation(_ context.Context, request service.OperationAuditRequest) error {
	r.requests = append(r.requests, request)
	return nil
}

func TestMenuPolicyUpdateAuditsOperation(t *testing.T) {
	catalog := &fakeCatalog{snapshot: service.CatalogSnapshot{Revision: "catalog-a", Definitions: []model.Definition{{ID: "root", ModuleID: "ops", RouteID: "root", DefaultOrder: 10, Manageable: true}}}}
	navigation, resource := newService(t, catalog)
	defer resource.Close()
	audit := &recordingOperationAudit{}
	navigation.WithOperationAudit(audit)

	order := 15
	if _, err := navigation.Update(t.Context(), service.UpdateCommand{NavigationID: "root", Enabled: true, OrderOverride: &order}); err != nil {
		t.Fatal(err)
	}
	if len(audit.requests) != 1 {
		t.Fatalf("menu policy update audit count = %d: %#v", len(audit.requests), audit.requests)
	}
	request := audit.requests[0]
	if request.Operation != "navigation.menus.update" || request.ResourceType != "menu" || request.ResourceID != "root" || request.Outcome != service.OperationSucceeded {
		t.Fatalf("menu policy update audit abnormal: %#v", request)
	}
}
