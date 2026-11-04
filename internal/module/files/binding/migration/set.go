// Package migration 提供 files 独立且可校验的增量迁移。
package migration

import (
	"embed"
	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
)

//go:embed sqlite/*.sql postgres/*.sql mysql/*.sql
var sqlFiles embed.FS

const CurrentVersion uint = 4
const TableName = "files_schema_migrations"

func Set() dbmigrate.Set {
	return dbmigrate.Set{Name: "files", FS: sqlFiles, CurrentVersion: CurrentVersion, MigrationsTable: TableName, DriverPaths: map[database.Driver]string{database.DriverSQLite: "sqlite", database.DriverPostgres: "postgres", database.DriverMySQL: "mysql"}, SHA256ByFile: map[string]string{
		"sqlite/000004_sharing.up.sql":              "33de57f80ecf7fde6196a00ff08f8b08d84bfe7608cb09bdc1c38378725c5c6e",
		"sqlite/000004_sharing.down.sql":            "2a68f6a47b4254db9fc84d5d61282b4e551c20a217457eca2ed4430b0dc8dacb",
		"postgres/000004_sharing.up.sql":            "33de57f80ecf7fde6196a00ff08f8b08d84bfe7608cb09bdc1c38378725c5c6e",
		"postgres/000004_sharing.down.sql":          "2a68f6a47b4254db9fc84d5d61282b4e551c20a217457eca2ed4430b0dc8dacb",
		"mysql/000004_sharing.up.sql":               "33de57f80ecf7fde6196a00ff08f8b08d84bfe7608cb09bdc1c38378725c5c6e",
		"mysql/000004_sharing.down.sql":             "2a68f6a47b4254db9fc84d5d61282b4e551c20a217457eca2ed4430b0dc8dacb",
		"sqlite/000003_content_revision.up.sql":     "11462426dea72268e3723367a5db0cebc3992f82e5d7af022f5e6a729a892366",
		"sqlite/000003_content_revision.down.sql":   "fe5a6dd0ec65d1bed039c55bf1f4c7137447b5e2fce3e3505e776966ddf66f17",
		"postgres/000003_content_revision.up.sql":   "11462426dea72268e3723367a5db0cebc3992f82e5d7af022f5e6a729a892366",
		"postgres/000003_content_revision.down.sql": "fe5a6dd0ec65d1bed039c55bf1f4c7137447b5e2fce3e3505e776966ddf66f17",
		"mysql/000003_content_revision.up.sql":      "11462426dea72268e3723367a5db0cebc3992f82e5d7af022f5e6a729a892366",
		"mysql/000003_content_revision.down.sql":    "fe5a6dd0ec65d1bed039c55bf1f4c7137447b5e2fce3e3505e776966ddf66f17",
		"sqlite/000002_storage_binding.up.sql":      "1b9f02be9b7a36751525aba35855c5153409610cb7e7bb8b864cc568d7717c3c",
		"sqlite/000002_storage_binding.down.sql":    "d3e7413436b3925eb6df22d773bb9fa9aac7949d20a9cacf7a1d80bf5028c379",
		"postgres/000002_storage_binding.up.sql":    "1b9f02be9b7a36751525aba35855c5153409610cb7e7bb8b864cc568d7717c3c",
		"postgres/000002_storage_binding.down.sql":  "d3e7413436b3925eb6df22d773bb9fa9aac7949d20a9cacf7a1d80bf5028c379",
		"mysql/000002_storage_binding.up.sql":       "1b9f02be9b7a36751525aba35855c5153409610cb7e7bb8b864cc568d7717c3c",
		"mysql/000002_storage_binding.down.sql":     "d3e7413436b3925eb6df22d773bb9fa9aac7949d20a9cacf7a1d80bf5028c379", "sqlite/000001_files.up.sql": "b9b5bde05566ddd9028d6e5eafd0a39cf51aa2c61f27244b139b5202b286e6ad", "sqlite/000001_files.down.sql": "e79feebd0adaff3b1f42a5f72d0d0d8b3372868d33836f3e2299fdd65c3c5bc3", "postgres/000001_files.up.sql": "b9b5bde05566ddd9028d6e5eafd0a39cf51aa2c61f27244b139b5202b286e6ad", "postgres/000001_files.down.sql": "e79feebd0adaff3b1f42a5f72d0d0d8b3372868d33836f3e2299fdd65c3c5bc3", "mysql/000001_files.up.sql": "b9b5bde05566ddd9028d6e5eafd0a39cf51aa2c61f27244b139b5202b286e6ad", "mysql/000001_files.down.sql": "e79feebd0adaff3b1f42a5f72d0d0d8b3372868d33836f3e2299fdd65c3c5bc3"}}
}
