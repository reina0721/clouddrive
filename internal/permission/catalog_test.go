package permission

import (
	"reflect"
	"strings"
	"testing"

	"github.com/reina0721/clouddrive/internal/module"
)

func TestBuildCatalogSortsAndProtectsDefinitions(t *testing.T) {
	input := []Definition{
		{Key: "todos:write", OwnerModuleID: module.ID("todo"), DescriptionMessageID: "permission.todo.write", Risk: RiskElevated},
		{Key: "todos:read", OwnerModuleID: module.ID("todo"), DescriptionMessageID: "permission.todo.read", Risk: RiskStandard},
	}
	catalog, err := BuildCatalog(input...)
	if err != nil {
		t.Fatal(err)
	}
	input[0].Key = "changed:key"
	definitions := catalog.Definitions()
	if got := []Key{definitions[0].Key, definitions[1].Key}; !reflect.DeepEqual(got, []Key{"todos:read", "todos:write"}) {
		t.Fatalf("unexpected stable order: %#v", got)
	}
	definitions[0].Key = "mutated:key"
	if _, exists := catalog.Lookup("todos:read"); !exists {
		t.Fatal("returned slice mutated catalog")
	}
}

func TestBuildCatalogRejectsInvalidAndDuplicateDefinitions(t *testing.T) {
	tests := []struct {
		name        string
		definitions []Definition
		want        string
	}{
		{name: "wildcard", definitions: []Definition{{Key: "todos:*", OwnerModuleID: "todo", DescriptionMessageID: "permission.todo.all", Risk: RiskStandard}}, want: "invalid"},
		{name: "empty owner", definitions: []Definition{{Key: "todos:read", DescriptionMessageID: "permission.todo.read", Risk: RiskStandard}}, want: "owner"},
		{name: "missing risk", definitions: []Definition{{Key: "todos:read", OwnerModuleID: "todo", DescriptionMessageID: "permission.todo.read"}}, want: "risk"},
		{name: "duplicate", definitions: []Definition{{Key: "todos:read", OwnerModuleID: "todo", DescriptionMessageID: "permission.todo.read", Risk: RiskStandard}, {Key: "todos:read", OwnerModuleID: "auth", DescriptionMessageID: "permission.auth.read", Risk: RiskElevated}}, want: "shared"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := BuildCatalog(test.definitions...)
			if err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("expected %q error, got %v", test.want, err)
			}
		})
	}
}

func TestCatalogValidatesReferences(t *testing.T) {
	catalog, err := BuildCatalog(Definition{Key: "todos:read", OwnerModuleID: "todo", DescriptionMessageID: "permission.todo.read", Risk: RiskStandard})
	if err != nil {
		t.Fatal(err)
	}
	if err := catalog.ValidateReferences(Reference{Key: "todos:read", ConsumerType: "operation", ConsumerID: "listTodos"}); err != nil {
		t.Fatal(err)
	}
	if err := catalog.ValidateReferences(Reference{Key: "todos:write", ConsumerType: "operation", ConsumerID: "createTodo"}); err == nil || !strings.Contains(err.Error(), "unknown") {
		t.Fatalf("expected unknown reference, got %v", err)
	}
}
