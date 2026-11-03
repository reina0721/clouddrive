// Package migration 绑定 Todo module 独占的三驱动 versioned SQL。
package migration

import (
	"embed"

	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
)

const (
	// CurrentVersion 是当前 Todo 二进制唯一兼容的 schema 版本。
	CurrentVersion uint = 1
	// TableName 是 Todo migration set 的版本表。
	TableName = "todo_schema_migrations"
)

//go:embed sqlite/*.sql postgres/*.sql mysql/*.sql
var sqlFiles embed.FS

// Set 返回 Todo-owned migration authority；checksum manifest 会阻止已发布 SQL 被静默改写。
func Set() dbmigrate.Set {
	return dbmigrate.Set{
		Name: "todo", FS: sqlFiles, CurrentVersion: CurrentVersion, MigrationsTable: TableName,
		DriverPaths: map[database.Driver]string{
			database.DriverSQLite: "sqlite", database.DriverPostgres: "postgres", database.DriverMySQL: "mysql",
		},
		SHA256ByFile: map[string]string{
			"sqlite/000001_create_todos.up.sql":     "778954db0634fc08ee2c578b24557aa20b773059f871656d1857cb706d4ec7c8",
			"sqlite/000001_create_todos.down.sql":   "d90654d38441d45165907144d4b536f44f904dbf5f9a547b33288dd33343f9be",
			"postgres/000001_create_todos.up.sql":   "64ef30608b2a1c4e797df8ddb0c386973bbee4f0682c98e505d774c49dd8ae9a",
			"postgres/000001_create_todos.down.sql": "d90654d38441d45165907144d4b536f44f904dbf5f9a547b33288dd33343f9be",
			"mysql/000001_create_todos.up.sql":      "7f74543dc92ffc790256b1aaf8fe7b8496bb40d1470bc8ac69eeaa5e30617f62",
			"mysql/000001_create_todos.down.sql":    "d90654d38441d45165907144d4b536f44f904dbf5f9a547b33288dd33343f9be",
		},
	}
}
