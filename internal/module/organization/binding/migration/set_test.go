package migration

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
)

func TestSetValidatesAllDriverChecksums(t *testing.T) {
	if err := dbmigrate.ValidateSet(Set()); err != nil {
		t.Fatal(err)
	}
}

func TestSQLiteMigrationIsRepeatable(t *testing.T) {
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = filepath.Join(t.TempDir(), "organization.db")
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
