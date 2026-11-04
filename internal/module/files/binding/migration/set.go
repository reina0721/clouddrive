// Package migration 提供 files 独立且可校验的增量迁移。
package migration

import (
	"embed"
	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
)

//go:embed sqlite/*.sql postgres/*.sql mysql/*.sql
var sqlFiles embed.FS

const CurrentVersion uint = 6
const TableName = "files_schema_migrations"

func Set() dbmigrate.Set {
	return dbmigrate.Set{Name: "files", FS: sqlFiles, CurrentVersion: CurrentVersion, MigrationsTable: TableName, DriverPaths: map[database.Driver]string{database.DriverSQLite: "sqlite", database.DriverPostgres: "postgres", database.DriverMySQL: "mysql"}, SHA256ByFile: map[string]string{
		"sqlite/000006_download_grants.up.sql":      "6d7cba082e941daa0c9342ba0159ca4bf6a9a1ac9ac13e78cf8d4647524db8a4",
		"sqlite/000006_download_grants.down.sql":    "1cd88c06c5e4e739a09c500e5f80af36ad8e80bd3a4434d8900c195d6ffcd416",
		"postgres/000006_download_grants.up.sql":    "6d7cba082e941daa0c9342ba0159ca4bf6a9a1ac9ac13e78cf8d4647524db8a4",
		"postgres/000006_download_grants.down.sql":  "1cd88c06c5e4e739a09c500e5f80af36ad8e80bd3a4434d8900c195d6ffcd416",
		"mysql/000006_download_grants.up.sql":       "6d7cba082e941daa0c9342ba0159ca4bf6a9a1ac9ac13e78cf8d4647524db8a4",
		"mysql/000006_download_grants.down.sql":     "1cd88c06c5e4e739a09c500e5f80af36ad8e80bd3a4434d8900c195d6ffcd416",
		"sqlite/000005_transfers.up.sql":            "7716d876de5a40a27d1339508f5224356567bde244fc160531a5bb518c057b0f",
		"sqlite/000005_transfers.down.sql":          "8b9fb008ec1309e91de788596e8775df51b3701d875d4ac02dace67aac97a117",
		"postgres/000005_transfers.up.sql":          "1c3f1463faa274f39c04211087f113755c6396ebd0026ab36424013735bffdf9",
		"postgres/000005_transfers.down.sql":        "8b9fb008ec1309e91de788596e8775df51b3701d875d4ac02dace67aac97a117",
		"mysql/000005_transfers.up.sql":             "4399b9565c48803a839cedbb8f6845235a4c67df51c60720fbef75831f7bbee8",
		"mysql/000005_transfers.down.sql":           "8b9fb008ec1309e91de788596e8775df51b3701d875d4ac02dace67aac97a117",
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
