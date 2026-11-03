// Package migration 绑定 Organization 独占的三驱动 versioned SQL。
package migration

import (
	"embed"

	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
)

const CurrentVersion uint = 3
const TableName = "organization_schema_migrations"

//go:embed sqlite/*.sql postgres/*.sql mysql/*.sql
var sqlFiles embed.FS

func Set() dbmigrate.Set {
	return dbmigrate.Set{Name: "organization", FS: sqlFiles, CurrentVersion: CurrentVersion, MigrationsTable: TableName,
		DriverPaths: map[database.Driver]string{database.DriverSQLite: "sqlite", database.DriverPostgres: "postgres", database.DriverMySQL: "mysql"},
		SHA256ByFile: map[string]string{
			"sqlite/000003_department_details.up.sql":     "a6c1c60042e96242340d74da327a23a6dd12874ef2d8438ecc0d8ba6c8af3690",
			"sqlite/000003_department_details.down.sql":   "8886e7859fe04b1fecf9ca2e008415bc5a577fc8d8e235953a6350a712f6ee21",
			"postgres/000003_department_details.up.sql":   "a6c1c60042e96242340d74da327a23a6dd12874ef2d8438ecc0d8ba6c8af3690",
			"postgres/000003_department_details.down.sql": "8886e7859fe04b1fecf9ca2e008415bc5a577fc8d8e235953a6350a712f6ee21",
			"mysql/000003_department_details.up.sql":      "a6c1c60042e96242340d74da327a23a6dd12874ef2d8438ecc0d8ba6c8af3690",
			"mysql/000003_department_details.down.sql":    "8886e7859fe04b1fecf9ca2e008415bc5a577fc8d8e235953a6350a712f6ee21",

			"sqlite/000001_create_organization.up.sql": "b692ff1332529a57cdbe9ece75eabec748cfffa15ca7d8ddd7cd7c0d3f092269", "sqlite/000001_create_organization.down.sql": "e2541af3dcedb5111b51a5ae53da59a0f713243f82adbf22b7ad373616a774e3",
			"postgres/000001_create_organization.up.sql": "03f4bd581cbfc13e262be3c427255998ac836ec9225e1b35bc63b7acfe4231e8", "postgres/000001_create_organization.down.sql": "948d0c4285befe87680fa75cbe569e77d7fc8e5901e5885d127e7c8676c5fffa",
			"mysql/000001_create_organization.up.sql": "d3662fcebc4989273fd4459508e25e10e6909954f6ddea1d67c1d723c8e684c5", "mysql/000001_create_organization.down.sql": "948d0c4285befe87680fa75cbe569e77d7fc8e5901e5885d127e7c8676c5fffa",
			"sqlite/000002_add_assignment_version.up.sql": "618a6abfefdbe7cd860c556033e67c984096c0adacbf578bc81792846b0c1dda", "sqlite/000002_add_assignment_version.down.sql": "cca94614d7fc7a29ed0ed37ae101d471e34a8d2195fc0c1dcf1eabeb6884b5b5",
			"postgres/000002_add_assignment_version.up.sql": "a85e2ba34ca0d37db7fbbfbdbe43046840c0f9ba3fba318709ab787cb3e1276c", "postgres/000002_add_assignment_version.down.sql": "cca94614d7fc7a29ed0ed37ae101d471e34a8d2195fc0c1dcf1eabeb6884b5b5",
			"mysql/000002_add_assignment_version.up.sql": "a85e2ba34ca0d37db7fbbfbdbe43046840c0f9ba3fba318709ab787cb3e1276c", "mysql/000002_add_assignment_version.down.sql": "cca94614d7fc7a29ed0ed37ae101d471e34a8d2195fc0c1dcf1eabeb6884b5b5",
		}}
}
