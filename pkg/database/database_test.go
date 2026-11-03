package database

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"
)

func TestSQLiteResourceAndDriverErrors(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state", "app.db")
	resource, err := NewGORM(t.Context(), &Config{Driver: DriverSQLite, DSN: path})
	if err != nil {
		t.Fatalf("NewGORM() error = %v", err)
	}
	t.Cleanup(func() { _ = resource.Close() })
	if runtime.GOOS != "windows" {
		assertMode(t, filepath.Dir(path), 0o700)
		assertMode(t, path, 0o600)
	}
	if err := UseGORM(t.Context(), resource.Client(), func(db *gorm.DB) error {
		return db.Exec(`
CREATE TABLE organizations (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE memberships (id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id));`).Error
	}); err != nil {
		t.Fatalf("create schema error = %v", err)
	}
	if err := UseGORM(t.Context(), resource.Client(), func(db *gorm.DB) error {
		return db.Exec("INSERT INTO organizations (id, name) VALUES (?, ?)", 1, "same").Error
	}); err != nil {
		t.Fatalf("insert organization error = %v", err)
	}
	if err := UseGORM(t.Context(), resource.Client(), func(db *gorm.DB) error {
		return db.Exec("INSERT INTO organizations (id, name) VALUES (?, ?)", 2, "same").Error
	}); !errors.Is(err, ErrDuplicateKey) {
		t.Fatalf("duplicate error = %v", err)
	}
	if err := UseGORM(t.Context(), resource.Client(), func(db *gorm.DB) error {
		return db.Exec("INSERT INTO memberships (id, organization_id) VALUES (?, ?)", 1, 999).Error
	}); !errors.Is(err, ErrForeignKeyViolation) {
		t.Fatalf("foreign key error = %v", err)
	}
}

func TestWithinTxCommitsAndRollsBack(t *testing.T) {
	resource := sqliteResource(t)
	defer resource.Close()
	client := resource.Client()
	if err := UseGORM(t.Context(), client, func(db *gorm.DB) error {
		return db.Exec("CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT NOT NULL)").Error
	}); err != nil {
		t.Fatal(err)
	}
	if err := client.WithinTx(t.Context(), func(ctx context.Context, tx Tx) error {
		return UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			return db.Exec("INSERT INTO accounts (id, name) VALUES (?, ?)", 1, "commit").Error
		})
	}); err != nil {
		t.Fatalf("WithinTx(commit) error = %v", err)
	}
	wantRollback := errors.New("rollback")
	err := client.WithinTx(t.Context(), func(ctx context.Context, tx Tx) error {
		if err := UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			return db.Exec("INSERT INTO accounts (id, name) VALUES (?, ?)", 2, "rollback").Error
		}); err != nil {
			return err
		}
		return wantRollback
	})
	if !errors.Is(err, wantRollback) {
		t.Fatalf("WithinTx(rollback) error = %v", err)
	}
	if count := countAccounts(t, client); count != 1 {
		t.Fatalf("count after rollback = %d", count)
	}
}

func TestResourceCloseInvalidatesClientAndIsIdempotent(t *testing.T) {
	resource := sqliteResource(t)
	client := resource.Client()
	if _, exposesOwnership := client.(Resource); exposesOwnership {
		t.Fatal("Client exposes Resource ownership through its dynamic type")
	}
	if err := resource.Close(); err != nil {
		t.Fatalf("first Close() error = %v", err)
	}
	if err := resource.Close(); err != nil {
		t.Fatalf("second Close() error = %v", err)
	}
	if err := UseGORM(t.Context(), client, func(*gorm.DB) error { return nil }); !errors.Is(err, ErrClientUnavailable) {
		t.Fatalf("closed Client error = %v", err)
	}
	if err := resource.Ping(t.Context()); !errors.Is(err, ErrClientUnavailable) {
		t.Fatalf("closed Resource Ping error = %v", err)
	}
}

func TestMigrationStatusRejectsInvalidTableIdentifier(t *testing.T) {
	resource := sqliteResource(t)
	defer resource.Close()
	if _, err := resource.Client().MigrationStatus(t.Context(), "schema;drop"); !errors.Is(err, ErrInvalidIdentifier) {
		t.Fatalf("MigrationStatus() error = %v", err)
	}
}

func TestPrivateSQLiteMemoryUsesSingleConnection(t *testing.T) {
	resource := sqliteResource(t)
	defer resource.Close()
	if got := resource.Stats().MaxOpenConnections; got != 1 {
		t.Fatalf("MaxOpenConnections = %d, want 1", got)
	}
}

func TestDirectTransactionInvalidatesEscapedTx(t *testing.T) {
	resource := sqliteResource(t)
	defer resource.Close()
	var escaped Tx
	if err := resource.Client().WithinTx(t.Context(), func(_ context.Context, tx Tx) error {
		escaped = tx
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if err := UseGORMTx(t.Context(), escaped, func(*gorm.DB) error { return nil }); !errors.Is(err, ErrClientUnavailable) {
		t.Fatalf("escaped Tx error = %v", err)
	}
}

func TestTransactionPanicRollsBackAndPreservesPanic(t *testing.T) {
	resource := sqliteResource(t)
	defer resource.Close()
	client := resource.Client()
	if err := UseGORM(t.Context(), client, func(db *gorm.DB) error {
		return db.Exec("CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT NOT NULL)").Error
	}); err != nil {
		t.Fatal(err)
	}
	panicValue := &struct{ name string }{name: "domain panic"}
	func() {
		defer func() {
			if recovered := recover(); recovered != panicValue {
				t.Fatalf("recovered panic = %#v", recovered)
			}
		}()
		_ = client.WithinTx(t.Context(), func(ctx context.Context, tx Tx) error {
			if err := UseGORMTx(ctx, tx, func(db *gorm.DB) error {
				return db.Exec("INSERT INTO accounts (id, name) VALUES (?, ?)", 1, "panic").Error
			}); err != nil {
				t.Fatal(err)
			}
			panic(panicValue)
		})
	}()
	if count := countAccounts(t, client); count != 0 {
		t.Fatalf("count after panic = %d", count)
	}
}

func TestTransactionOperationCannotBypassRootCancellation(t *testing.T) {
	resource := sqliteResource(t)
	defer resource.Close()
	txCtx, cancel := context.WithCancel(t.Context())
	wantErr := errors.New("transaction cancelled")
	err := resource.Client().WithinTx(txCtx, func(_ context.Context, tx Tx) error {
		cancel()
		if err := UseGORMTx(context.Background(), tx, func(*gorm.DB) error { return nil }); !errors.Is(err, context.Canceled) {
			t.Fatalf("session error = %v", err)
		}
		return wantErr
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("WithinTx() error = %v", err)
	}
}

func TestConfigValidationAndErrorRedaction(t *testing.T) {
	if err := ValidateConfig(&Config{Driver: Driver("oracle"), DSN: "secret"}); !errors.Is(err, ErrInvalidDriver) {
		t.Fatalf("ValidateConfig() error = %v", err)
	}
	secret := "postgres://user:top-secret@example.invalid/app"
	resource, err := NewGORM(t.Context(), &Config{Driver: DriverPostgres, DSN: secret, PingTimeout: time.Millisecond})
	if err != nil {
		t.Fatalf("NewGORM() should not ping: %v", err)
	}
	defer resource.Close()
	err = resource.Ping(t.Context())
	if err == nil {
		t.Fatal("Ping() returned nil error")
	}
	if strings.Contains(err.Error(), secret) || strings.Contains(err.Error(), "top-secret") {
		t.Fatalf("error leaks DSN: %v", err)
	}
	assertErrorTreeRedacted(t, err, secret, "top-secret")
	var nilClient *gormClient
	if err := Borrow(t.Context(), nilClient, func(Client) error { return nil }); !errors.Is(err, ErrClientUnavailable) {
		t.Fatalf("Borrow(typed nil) error = %v", err)
	}
	if err := Borrow(t.Context(), &gormClient{}, nil); !errors.Is(err, ErrNilClientFunc) {
		t.Fatalf("Borrow(nil func) error = %v", err)
	}
}

func TestResourceCloseCachesFirstTerminalResult(t *testing.T) {
	cause := errors.New("close failed")
	attempts := 0
	resource := &gormResource{client: &gormClient{}, close: func() error {
		attempts++
		return cause
	}}
	if first, second := resource.Close(), resource.Close(); !errors.Is(first, cause) || !errors.Is(second, cause) {
		t.Fatalf("Close() errors = %v / %v", first, second)
	}
	if attempts != 1 {
		t.Fatalf("Close() attempts = %d", attempts)
	}
}

func TestConfiguredServerDrivers(t *testing.T) {
	for _, test := range []struct {
		name   string
		driver Driver
		env    string
	}{
		{name: "postgres", driver: DriverPostgres, env: "TEST_DATABASE_POSTGRES_DSN"},
		{name: "mysql", driver: DriverMySQL, env: "TEST_DATABASE_MYSQL_DSN"},
	} {
		t.Run(test.name, func(t *testing.T) {
			dsn := os.Getenv(test.env)
			if dsn == "" {
				t.Skipf("%s is not configured", test.env)
			}
			resource, err := NewGORM(t.Context(), &Config{Driver: test.driver, DSN: dsn})
			if err != nil {
				t.Fatalf("NewGORM(%s) error = %v", test.driver, err)
			}
			defer resource.Close()
			if err := resource.Ping(t.Context()); err != nil {
				t.Fatalf("Ping(%s) error = %v", test.driver, err)
			}
		})
	}
}

func countAccounts(t *testing.T, client Client) int64 {
	t.Helper()
	var count int64
	if err := UseGORM(t.Context(), client, func(db *gorm.DB) error {
		return db.Table("accounts").Count(&count).Error
	}); err != nil {
		t.Fatal(err)
	}
	return count
}

func assertErrorTreeRedacted(t *testing.T, err error, forbidden ...string) {
	t.Helper()
	visited := map[error]struct{}{}
	var inspect func(error)
	inspect = func(current error) {
		if current == nil {
			return
		}
		if _, exists := visited[current]; exists {
			return
		}
		visited[current] = struct{}{}
		for _, value := range forbidden {
			if strings.Contains(current.Error(), value) {
				t.Fatalf("error tree leaks %q: %v", value, current)
			}
		}
		switch value := current.(type) {
		case interface{ Unwrap() []error }:
			for _, nested := range value.Unwrap() {
				inspect(nested)
			}
		case interface{ Unwrap() error }:
			inspect(value.Unwrap())
		}
	}
	inspect(err)
}

func assertMode(t *testing.T, path string, want os.FileMode) {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat %s: %v", path, err)
	}
	if got := info.Mode().Perm(); got != want {
		t.Fatalf("mode %s = %o, want %o", path, got, want)
	}
}
