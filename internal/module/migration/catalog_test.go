package migration_test

import (
	"strings"
	"testing"

	modulemigration "github.com/reina0721/clouddrive/internal/module/migration"
	todomigration "github.com/reina0721/clouddrive/internal/module/todo/binding/migration"
)

func TestCatalogStableOrderAndImmutableCopies(t *testing.T) {
	todoSet, otherSet := todomigration.Set(), todomigration.Set()
	otherSet.Name, otherSet.MigrationsTable = "other", "other_schema_migrations"
	catalog, err := modulemigration.BuildCatalog(
		modulemigration.Registration{ModuleID: "todo", Source: "source/todo", Set: todoSet},
		modulemigration.Registration{ModuleID: "alpha", Source: "source/alpha", Set: otherSet},
	)
	if err != nil {
		t.Fatal(err)
	}
	registrations := catalog.Registrations()
	if registrations[0].ModuleID != "alpha" || registrations[1].ModuleID != "todo" {
		t.Fatalf("unstable order: %#v", registrations)
	}
	registrations[0].Set.DriverPaths = nil
	if catalog.Registrations()[0].Set.DriverPaths == nil {
		t.Fatal("returned registration mutated catalog")
	}
}

func TestCatalogRejectsOwnerConflicts(t *testing.T) {
	base := todomigration.Set()
	for _, test := range []struct {
		name   string
		mutate func(*modulemigration.Registration)
		want   string
	}{
		{name: "module", mutate: func(value *modulemigration.Registration) { value.ModuleID = "todo" }, want: "duplicated"},
		{name: "source", mutate: func(value *modulemigration.Registration) { value.Source = "source/todo" }, want: "source"},
		{name: "set", mutate: func(value *modulemigration.Registration) { value.Set.Name = base.Name }, want: "set"},
		{name: "table", mutate: func(value *modulemigration.Registration) { value.Set.MigrationsTable = base.MigrationsTable }, want: "version table"},
	} {
		t.Run(test.name, func(t *testing.T) {
			other := base
			other.DriverPaths = clone(base.DriverPaths)
			other.SHA256ByFile = clone(base.SHA256ByFile)
			other.Name, other.MigrationsTable = "other", "other_schema_migrations"
			registration := modulemigration.Registration{ModuleID: "other", Source: "source/other", Set: other}
			test.mutate(&registration)
			_, err := modulemigration.BuildCatalog(modulemigration.Registration{ModuleID: "todo", Source: "source/todo", Set: base}, registration)
			if err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("expected %q error, got %v", test.want, err)
			}
		})
	}
}

func clone[K comparable, V any](source map[K]V) map[K]V {
	result := make(map[K]V, len(source))
	for key, value := range source {
		result[key] = value
	}
	return result
}
