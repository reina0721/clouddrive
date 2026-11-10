package migration

import (
	"embed"
	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
)

//go:embed sqlite/*.sql postgres/*.sql mysql/*.sql
var sqlFiles embed.FS

const CurrentVersion uint = 2
const TableName = "console_schema_migrations"

func Set() dbmigrate.Set {
	return dbmigrate.Set{Name: "console", FS: sqlFiles, CurrentVersion: CurrentVersion, MigrationsTable: TableName, DriverPaths: map[database.Driver]string{database.DriverSQLite: "sqlite", database.DriverPostgres: "postgres", database.DriverMySQL: "mysql"}, SHA256ByFile: map[string]string{"sqlite/000001_console.up.sql": "5f6ec02f7d8717dac786ea4b9a724aaa2251bcceb2928fed95f51edcb9cadb08",
		"sqlite/000001_console.down.sql":        "bb4a6a6f794d3c56d5a0b701bd885c29f867a793e32d8068caaf6555f8d76d5f",
		"postgres/000001_console.up.sql":        "7618c6425d91f93b198843d3ba8ff59680b71cd69d694816877489dd01468821",
		"postgres/000001_console.down.sql":      "bb4a6a6f794d3c56d5a0b701bd885c29f867a793e32d8068caaf6555f8d76d5f",
		"mysql/000001_console.up.sql":           "bf08ea93c031d689e81b9596a8c40cc111e3381af86ff7a6a0771409c4a5e72c",
		"mysql/000001_console.down.sql":         "bb4a6a6f794d3c56d5a0b701bd885c29f867a793e32d8068caaf6555f8d76d5f",
		"mysql/000002_site_profile.up.sql":      "a7ba233ae53c5198109b8d3ef4775cc2010cdbc5b3636d3b36c1c58ca81719d8",
		"mysql/000002_site_profile.down.sql":    "51149e93b603912de09f76ccdbb372dfac46824ff0bbb9e2632fed99a13be03a",
		"postgres/000002_site_profile.up.sql":   "a7ba233ae53c5198109b8d3ef4775cc2010cdbc5b3636d3b36c1c58ca81719d8",
		"postgres/000002_site_profile.down.sql": "51149e93b603912de09f76ccdbb372dfac46824ff0bbb9e2632fed99a13be03a",
		"sqlite/000002_site_profile.up.sql":     "a7ba233ae53c5198109b8d3ef4775cc2010cdbc5b3636d3b36c1c58ca81719d8",
		"sqlite/000002_site_profile.down.sql":   "51149e93b603912de09f76ccdbb372dfac46824ff0bbb9e2632fed99a13be03a",
	}}
}
