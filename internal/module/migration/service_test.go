package migration_test

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	modulemigration "github.com/reina0721/clouddrive/internal/module/migration"
	migrationconfig "github.com/reina0721/clouddrive/internal/module/migration/binding/config"
	todomigration "github.com/reina0721/clouddrive/internal/module/todo/binding/migration"
	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
)

func TestConfiguredServerMigrations(t *testing.T) {
	for _, test := range []struct {
		name   string
		driver database.Driver
		env    string
	}{
		{name: "postgres", driver: database.DriverPostgres, env: "TEST_MIGRATION_POSTGRES_DSN"},
		{name: "mysql", driver: database.DriverMySQL, env: "TEST_MIGRATION_MYSQL_DSN"},
	} {
		t.Run(test.name, func(t *testing.T) {
			dsn := os.Getenv(test.env)
			if dsn == "" {
				t.Skipf("%s is not configured", test.env)
			}
			config := database.DefaultConfig()
			config.Driver, config.DSN = test.driver, dsn
			service := newService(t, config)
			for attempt := 1; attempt <= 2; attempt++ {
				status, err := service.Up(t.Context())
				if err != nil || !status.Compatible || len(status.Sets) != 1 || status.Sets[0].Current != todomigration.CurrentVersion {
					t.Fatalf("Up(%s, attempt %d) = %#v, %v", test.driver, attempt, status, err)
				}
			}
		})
	}
}

func TestSQLiteMigrationFreshAndIdempotent(t *testing.T) {
	databasePath := filepath.Join(t.TempDir(), "migration.db")
	config := database.DefaultConfig()
	config.Driver, config.DSN = database.DriverSQLite, databasePath
	service := newService(t, config)

	status, err := service.Status(t.Context())
	if err != nil || status.Compatible || len(status.Sets) != 1 || !status.Sets[0].Empty {
		t.Fatalf("Status(empty) = %#v, %v", status, err)
	}
	connection := openSQLite(t, databasePath)
	assertTableCount(t, connection, todomigration.TableName, 0)
	if err := connection.Close(); err != nil {
		t.Fatal(err)
	}

	for attempt := 1; attempt <= 2; attempt++ {
		status, err = service.Up(t.Context())
		if err != nil || !status.Compatible || status.Sets[0].Dirty || status.Sets[0].Current != 1 {
			t.Fatalf("Up(attempt %d) = %#v, %v", attempt, status, err)
		}
	}
	connection = openSQLite(t, databasePath)
	defer connection.Close()
	assertTableCount(t, connection, todomigration.TableName, 1)
	var notNull int
	rows, err := connection.QueryContext(t.Context(), "PRAGMA table_info(todos)")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var cid, primaryKey int
		var name, kind string
		var defaultValue any
		if err := rows.Scan(&cid, &name, &kind, &notNull, &defaultValue, &primaryKey); err != nil {
			t.Fatal(err)
		}
		if name == "owner_subject" && notNull == 1 {
			return
		}
	}
	t.Fatal("owner_subject NOT NULL contract is missing")
}

func TestSQLiteRetiredBaselineIsRejectedBeforeRunnerWrites(t *testing.T) {
	databasePath := filepath.Join(t.TempDir(), "legacy.db")
	connection := openSQLite(t, databasePath)
	if _, err := connection.ExecContext(t.Context(), "CREATE TABLE schema_migrations (version INTEGER NOT NULL, dirty BOOLEAN NOT NULL)"); err != nil {
		t.Fatal(err)
	}
	if err := connection.Close(); err != nil {
		t.Fatal(err)
	}
	config := database.DefaultConfig()
	config.Driver, config.DSN = database.DriverSQLite, databasePath
	service := newService(t, config)
	if _, err := service.Up(t.Context()); !errors.Is(err, modulemigration.ErrPreReleaseBaselineResetRequired) {
		t.Fatalf("expected baseline reset error, got %v", err)
	}
	connection = openSQLite(t, databasePath)
	defer connection.Close()
	assertTableCount(t, connection, todomigration.TableName, 0)
	assertTableCount(t, connection, "todos", 0)
}

func TestUpPreservesOperationAndCloseErrors(t *testing.T) {
	operationErr, closeErr := errors.New("operation failed"), errors.New("close failed")
	set := todomigration.Set()
	catalog, err := modulemigration.BuildCatalog(modulemigration.Registration{ModuleID: "todo", Source: "test/todo", Set: set})
	if err != nil {
		t.Fatal(err)
	}
	config := database.DefaultConfig()
	config.DSN = filepath.Join(t.TempDir(), "errors.db")
	service, err := modulemigration.New(config, migrationconfig.Config{LockTimeout: time.Second, OperationTimeout: 2 * time.Second}, catalog,
		func(context.Context, dbmigrate.Config, dbmigrate.Set) (modulemigration.Runner, error) {
			return &runnerStub{upErr: operationErr, closeErr: closeErr}, nil
		}, func(context.Context, database.Config, modulemigration.Catalog) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	_, err = service.Up(t.Context())
	if !errors.Is(err, operationErr) || !errors.Is(err, closeErr) {
		t.Fatalf("joined error = %v", err)
	}
}

type runnerStub struct {
	upErr    error
	closeErr error
}

func (stub *runnerStub) Status(context.Context) (dbmigrate.Status, error) {
	return dbmigrate.Status{Version: 1}, nil
}
func (stub *runnerStub) Up(context.Context) error { return stub.upErr }
func (stub *runnerStub) Close() error             { return stub.closeErr }

func newService(t *testing.T, config database.Config) *modulemigration.Service {
	t.Helper()
	catalog, err := modulemigration.BuildCatalog(modulemigration.Registration{
		ModuleID: "todo", Source: "internal/module/todo/binding/migration", Set: todomigration.Set(),
		RetiredTables: []string{"schema_migrations", "webui_sessions", "webui_users"},
	})
	if err != nil {
		t.Fatal(err)
	}
	module, err := modulemigration.NewModule(config, migrationconfig.Config{LockTimeout: 5 * time.Second, OperationTimeout: 30 * time.Second}, catalog, modulemigration.NewDefaultFactory, modulemigration.DefaultPreflight)
	if err != nil {
		t.Fatal(err)
	}
	return module.Service
}

func openSQLite(t *testing.T, path string) *sql.DB {
	t.Helper()
	connection, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	return connection
}

func assertTableCount(t *testing.T, connection *sql.DB, table string, want int) {
	t.Helper()
	var count int
	if err := connection.QueryRowContext(t.Context(), "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?", table).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != want {
		t.Fatalf("table %s count = %d, want %d", table, count, want)
	}
}
