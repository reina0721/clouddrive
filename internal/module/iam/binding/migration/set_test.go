package migration

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
	"gorm.io/gorm"
)

func TestSetValidatesAllDriverChecksums(t *testing.T) {
	if err := dbmigrate.ValidateSet(Set()); err != nil {
		t.Fatal(err)
	}
}

func TestSQLiteMigrationIsRepeatable(t *testing.T) {
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = filepath.Join(t.TempDir(), "iam-migration.db")
	runner, err := dbmigrate.New(context.Background(), dbmigrate.Config{Database: config, LockTimeout: 5 * time.Second}, Set())
	if err != nil {
		t.Fatal(err)
	}
	defer runner.Close()
	if err := runner.Up(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := runner.Up(t.Context()); err != nil {
		t.Fatalf("repeat up: %v", err)
	}
}

// TestConfiguredServerMigrationsThreeDialects 在配置外部 DSN 时验证
// Postgres/MySQL 的 IAM migration 可前滚两次并保持幂等；
// 无 DSN 时跳过（与项目既有 database contract 门禁一致）。
func TestConfiguredServerMigrationsThreeDialects(t *testing.T) {
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
			runner, err := dbmigrate.New(t.Context(), dbmigrate.Config{Database: config, LockTimeout: 5 * time.Second}, Set())
			if err != nil {
				t.Fatal(err)
			}
			defer runner.Close()
			for attempt := 1; attempt <= 2; attempt++ {
				if err := runner.Up(t.Context()); err != nil {
					t.Fatalf("Up(%s, attempt %d): %v", test.driver, attempt, err)
				}
			}
			status, err := runner.Status(t.Context())
			if err != nil || status.Version != CurrentVersion || status.Dirty {
				t.Fatalf("Status(%s) = %#v, %v", test.driver, status, err)
			}
			if err := assertAuthorizationStateSeeded(t, config); err != nil {
				t.Fatalf("authorization state contract: %v", err)
			}
			// 前滚升级不删除既有业务表。
			if err := assertIAMTablesPreserved(t, config); err != nil {
				t.Fatalf("existing data preserved: %v", err)
			}
		})
	}
}

func assertAuthorizationStateSeeded(t *testing.T, config database.Config) error {
	t.Helper()
	resource, err := database.NewGORM(t.Context(), &config)
	if err != nil {
		return err
	}
	defer resource.Close()
	return database.Borrow(t.Context(), resource.Client(), func(client database.Client) error {
		return database.UseGORM(t.Context(), client, func(db *gorm.DB) error {
			var revision int64
			if err := db.Raw("SELECT revision FROM iam_authorization_state WHERE id = 1").Scan(&revision).Error; err != nil {
				return err
			}
			if revision != 1 {
				return fmt.Errorf("seeded revision = %d, want 1", revision)
			}
			return nil
		})
	})
}

// assertIAMTablesPreserved 验证前滚升级后既有 IAM 业务表仍然存在。
func assertIAMTablesPreserved(t *testing.T, config database.Config) error {
	t.Helper()
	resource, err := database.NewGORM(t.Context(), &config)
	if err != nil {
		return err
	}
	defer resource.Close()
	return database.Borrow(t.Context(), resource.Client(), func(client database.Client) error {
		return database.UseGORM(t.Context(), client, func(db *gorm.DB) error {
			for _, table := range []string{"iam_accounts", "iam_local_credentials", "iam_roles", "iam_account_roles", "iam_role_permissions", "iam_sessions", "iam_user_preferences"} {
				if err := assertTableExists(config.Driver, table, db); err != nil {
					return err
				}
			}
			return nil
		})
	})
}

func assertTableExists(driver database.Driver, table string, db *gorm.DB) error {
	switch driver {
	case database.DriverPostgres:
		var name *string
		if err := db.Raw("SELECT to_regclass(?)", table).Scan(&name).Error; err != nil {
			return err
		}
		if name == nil {
			return fmt.Errorf("table %s is missing", table)
		}
	case database.DriverMySQL:
		var count int64
		if err := db.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?", table).Scan(&count).Error; err != nil {
			return err
		}
		if count != 1 {
			return fmt.Errorf("table %s is missing", table)
		}
	default:
		return fmt.Errorf("unsupported contract driver %q", driver)
	}
	return nil
}
