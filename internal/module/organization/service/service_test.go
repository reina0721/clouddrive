package service_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	migrationbinding "github.com/reina0721/clouddrive/internal/module/organization/binding/migration"
	"github.com/reina0721/clouddrive/internal/module/organization/model"
	"github.com/reina0721/clouddrive/internal/module/organization/repo"
	"github.com/reina0721/clouddrive/internal/module/organization/service"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

func TestDepartmentTreeCycleAndReferenceRules(t *testing.T) {
	organization, resource := newService(t, accountDirectory{})
	defer resource.Close()
	root, err := organization.CreateDepartment(t.Context(), "engineering", "研发部", nil)
	if err != nil {
		t.Fatal(err)
	}
	child, err := organization.CreateDepartment(t.Context(), "platform", "平台组", &root.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := organization.UpdateDepartment(t.Context(), service.UpdateDepartmentCommand{ID: root.ID, Version: root.Version, ParentID: pointer(&child.ID)}); !errors.Is(err, model.ErrCycle) {
		t.Fatalf("cycle error = %v", err)
	}
	archived := true
	if _, err := organization.UpdateDepartment(t.Context(), service.UpdateDepartmentCommand{ID: root.ID, Version: root.Version, Archived: &archived}); !errors.Is(err, model.ErrReferenced) {
		t.Fatalf("referenced error = %v", err)
	}
	tree, err := organization.DepartmentTree(t.Context(), true)
	if err != nil || len(tree) != 1 || len(tree[0].Children) != 1 || tree[0].Children[0].Department.ID != child.ID {
		t.Fatalf("tree = %#v, error = %v", tree, err)
	}
}

func TestAssignmentUsesOneDepartmentAndDeduplicatedPositions(t *testing.T) {
	organization, resource := newService(t, accountDirectory{})
	defer resource.Close()
	department, err := organization.CreateDepartment(t.Context(), "sales", "销售部", nil)
	if err != nil {
		t.Fatal(err)
	}
	first, err := organization.CreatePosition(t.Context(), "manager", "经理")
	if err != nil {
		t.Fatal(err)
	}
	second, err := organization.CreatePosition(t.Context(), "specialist", "专员")
	if err != nil {
		t.Fatal(err)
	}
	accountID := "a9f41ec8-7a6a-4b79-b76f-eedc8f2eef66"
	assignment, err := organization.ReplaceAssignment(t.Context(), accountID, 0, &department.ID, []string{second.ID, first.ID, first.ID})
	if err != nil {
		t.Fatal(err)
	}
	positionSet := map[string]bool{}
	for _, id := range assignment.PositionIDs {
		positionSet[id] = true
	}
	if assignment.DepartmentID == nil || *assignment.DepartmentID != department.ID || len(assignment.PositionIDs) != 2 || !positionSet[first.ID] || !positionSet[second.ID] {
		t.Fatalf("assignment = %#v", assignment)
	}
	archived := true
	if _, err := organization.UpdatePosition(t.Context(), service.UpdatePositionCommand{ID: first.ID, Version: first.Version, Archived: &archived}); !errors.Is(err, model.ErrReferenced) {
		t.Fatalf("position reference error = %v", err)
	}
}

func TestRejectedAccountLeavesNoOrganizationRelationship(t *testing.T) {
	organization, resource := newService(t, accountDirectory{err: errors.New("disabled")})
	defer resource.Close()
	accountID := "1c05bf1c-02fc-4508-8d24-b90a230585b4"
	if _, err := organization.ReplaceAssignment(t.Context(), accountID, 0, nil, nil); !errors.Is(err, model.ErrAccountInvalid) {
		t.Fatalf("assignment error = %v", err)
	}
}

// TestAssignmentVersionConflict 验证组织分配乐观锁：过期 expectedVersion
// 返回稳定冲突，正确版本成功且返回新版本。
func TestAssignmentVersionConflict(t *testing.T) {
	organization, resource := newService(t, accountDirectory{})
	defer resource.Close()
	department, err := organization.CreateDepartment(t.Context(), "sales", "销售部", nil)
	if err != nil {
		t.Fatal(err)
	}
	accountID := "a9f41ec8-7a6a-4b79-b76f-eedc8f2eef66"
	// 过期版本 → 稳定冲突。
	if _, err := organization.ReplaceAssignment(t.Context(), accountID, 99, &department.ID, nil); !errors.Is(err, database.ErrOptimisticConflict) {
		t.Fatalf("stale assignment version error = %v", err)
	}
	assignment, err := organization.ReplaceAssignment(t.Context(), accountID, 0, &department.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if assignment.Version != 1 {
		t.Fatalf("assignment version = %d, want 1", assignment.Version)
	}
	// 再次替换用新版本成功。
	updated, err := organization.ReplaceAssignment(t.Context(), accountID, assignment.Version, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if updated.DepartmentID != nil || updated.Version != 2 {
		t.Fatalf("updated assignment = %#v", updated)
	}
}

type accountDirectory struct{ err error }

func (directory accountDirectory) RequireAssignableAccount(context.Context, string) error {
	return directory.err
}

func newService(t *testing.T, accounts service.AccountDirectory) (*service.Service, database.Resource) {
	t.Helper()
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = filepath.Join(t.TempDir(), "organization.db")
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
	store, err := repo.New(resourceAccess{resource: resource})
	if err != nil {
		t.Fatal(err)
	}
	organization, err := service.New(store, clock.Fixed(time.Date(2026, 8, 22, 8, 0, 0, 0, time.UTC)), idgen.UUID(), accounts)
	if err != nil {
		t.Fatal(err)
	}
	return organization, resource
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

func pointer(value *string) **string { return &value }

type recordingOperationAudit struct {
	requests []service.OperationAuditRequest
}

func (r *recordingOperationAudit) RecordOperation(_ context.Context, request service.OperationAuditRequest) error {
	r.requests = append(r.requests, request)
	return nil
}

func TestWriteOperationsAuditOrganizationOutcome(t *testing.T) {
	organization, resource := newService(t, accountDirectory{})
	defer resource.Close()
	audit := &recordingOperationAudit{}
	organization.WithOperationAudit(audit)

	department, err := organization.CreateDepartment(t.Context(), "eng", "Engineering", nil)
	if err != nil {
		t.Fatal(err)
	}
	position, err := organization.CreatePosition(t.Context(), "lead", "Lead")
	if err != nil {
		t.Fatal(err)
	}
	parentDepartment, err := organization.CreateDepartment(t.Context(), "parent", "Parent", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := organization.UpdateDepartment(t.Context(), service.UpdateDepartmentCommand{ID: department.ID, Version: department.Version, ParentID: pointer(&parentDepartment.ID)}); err != nil {
		t.Fatal(err)
	}
	if _, err := organization.UpdatePosition(t.Context(), service.UpdatePositionCommand{ID: position.ID, Version: position.Version, Name: ptr("Lead Engineer")}); err != nil {
		t.Fatal(err)
	}
	if _, err := organization.ReplaceAssignment(t.Context(), "acct-1", 0, &department.ID, []string{position.ID}); err != nil {
		t.Fatal(err)
	}

	byOperation := map[string]bool{}
	for _, request := range audit.requests {
		byOperation[request.Operation] = true
		if request.ResourceID == "" || request.Outcome != service.OperationSucceeded {
			t.Fatalf("operation audit abnormal: %#v", request)
		}
	}
	for _, expected := range []string{"organization.departments.create", "organization.positions.create", "organization.departments.update", "organization.positions.update", "organization.assignments.replace"} {
		if !byOperation[expected] {
			t.Fatalf("operation audit missing %q: %#v", expected, audit.requests)
		}
	}
}

// TestListQueryValidationRejectsInvalidPage 验证 BE-090-001：组织列表过大
// 分页返回稳定 ErrInvalidQuery（不再落 500）。
func TestListQueryValidationRejectsInvalidPage(t *testing.T) {
	organization, resource := newService(t, accountDirectory{})
	defer resource.Close()
	if _, err := organization.ListDepartments(t.Context(), 0, 1001, false, ""); !errors.Is(err, model.ErrInvalidQuery) {
		t.Fatalf("oversized department page error = %v", err)
	}
	if _, err := organization.ListPositions(t.Context(), 0, 1001, false, ""); !errors.Is(err, model.ErrInvalidQuery) {
		t.Fatalf("oversized position page error = %v", err)
	}
}

func ptr(value string) *string { return &value }
