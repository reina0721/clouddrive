package migration

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
)

func TestSetAndSQLiteRepeatability(t *testing.T) {
	if err := dbmigrate.ValidateSet(Set()); err != nil {
		t.Fatal(err)
	}
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = filepath.Join(t.TempDir(), "navigation.db")
	runner, err := dbmigrate.New(t.Context(), dbmigrate.Config{Database: config, LockTimeout: 5 * time.Second}, Set())
	if err != nil {
		t.Fatal(err)
	}
	defer runner.Close()
	if err := runner.Up(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := runner.Up(t.Context()); err != nil {
		t.Fatal(err)
	}
}

func TestSchemaDoesNotCreateDynamicPagesOrRoleMenuAuthority(t *testing.T) {
	for _, driver := range []string{"sqlite", "postgres", "mysql"} {
		path := driver + "/000001_create_navigation.up.sql"
		content, err := sqlFiles.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		lower := strings.ToLower(string(content))
		for _, forbidden := range []string{"component", "entry_id", "route_path", "role_menu", "view_operation"} {
			if strings.Contains(lower, forbidden) {
				t.Fatalf("%s contains forbidden dynamic authority %q", path, forbidden)
			}
		}
	}
}
