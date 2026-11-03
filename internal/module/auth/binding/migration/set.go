// Package migration 绑定 Auth 独占的低敏审计事件表版本化 SQL。
package migration

import (
	"embed"

	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
)

const CurrentVersion uint = 2
const TableName = "auth_schema_migrations"

//go:embed sqlite/*.sql postgres/*.sql mysql/*.sql
var sqlFiles embed.FS

func Set() dbmigrate.Set {
	return dbmigrate.Set{
		Name: "auth", FS: sqlFiles, CurrentVersion: CurrentVersion, MigrationsTable: TableName,
		DriverPaths: map[database.Driver]string{database.DriverSQLite: "sqlite", database.DriverPostgres: "postgres", database.DriverMySQL: "mysql"},
		SHA256ByFile: map[string]string{
			"sqlite/000001_create_auth_audit_events.up.sql":     "3632fec8638c63c26006547cc59b43b523c6a49a457f2b65f2ed0cbfa89cef30",
			"sqlite/000001_create_auth_audit_events.down.sql":   "20d231aa4d1f563a9f8b2a813619f599b7511a0cab6859dd64f961c5fe8a03d8",
			"postgres/000001_create_auth_audit_events.up.sql":   "83b592ac678cb8edcfc6325b3fdde6a694b1e0ac884ca34db5a52762727bd262",
			"postgres/000001_create_auth_audit_events.down.sql": "20d231aa4d1f563a9f8b2a813619f599b7511a0cab6859dd64f961c5fe8a03d8",
			"mysql/000001_create_auth_audit_events.up.sql":      "b3daa7245a9b4a2a32ef3fb2379a60e96d58cfa2365d09d7c819da986764e0a9",
			"mysql/000001_create_auth_audit_events.down.sql":    "20d231aa4d1f563a9f8b2a813619f599b7511a0cab6859dd64f961c5fe8a03d8",
			"sqlite/000002_add_audit_correlation_id.up.sql":     "d9a59346235ed029f691fb521b9e9c4964cf2e98ac424a1bb669c8b33eddf501",
			"sqlite/000002_add_audit_correlation_id.down.sql":   "c078400401dd2828a7fa9a05dd20d0f3bd6eff75dbe9f568fef898c173d49a25",
			"postgres/000002_add_audit_correlation_id.up.sql":   "d9a59346235ed029f691fb521b9e9c4964cf2e98ac424a1bb669c8b33eddf501",
			"postgres/000002_add_audit_correlation_id.down.sql": "c078400401dd2828a7fa9a05dd20d0f3bd6eff75dbe9f568fef898c173d49a25",
			"mysql/000002_add_audit_correlation_id.up.sql":      "9b08976329c51b9958c128abcd36e6cf8499fe410e41e393a27ea6bf6f393082",
			"mysql/000002_add_audit_correlation_id.down.sql":    "2eca20281b769bd59cb5d629f9ae63bc83ed061f873436e7d98856011a915aa5",
		},
	}
}
