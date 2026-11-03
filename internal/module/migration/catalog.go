package migration

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/reina0721/clouddrive/internal/module"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
)

// Completion 是模块在版本 SQL 之外拥有的确定性数据完成门禁。
// 无此需求的 migration set 必须传 nil，不创建空实现占位。
type Completion interface {
	Resolve(context.Context) error
	Verify(context.Context) error
}

// Registration 是一个业务模块交给应用组合根的 migration 完成品。
type Registration struct {
	ModuleID      module.ID
	Source        string
	Set           dbmigrate.Set
	Completion    Completion
	RetiredTables []string
}

// Catalog 是按 ModuleID 稳定排序的不可变 migration set 目录。
type Catalog struct{ registrations []Registration }

// BuildCatalog 校验 module/set/source/version table owner，并构造不可变目录。
func BuildCatalog(registrations ...Registration) (Catalog, error) {
	copyRegistrations := make([]Registration, len(registrations))
	for index, registration := range registrations {
		copyRegistrations[index] = cloneRegistration(registration)
	}
	sort.Slice(copyRegistrations, func(left, right int) bool {
		return copyRegistrations[left].ModuleID < copyRegistrations[right].ModuleID
	})
	modules := make(map[module.ID]struct{}, len(copyRegistrations))
	sets := make(map[string]module.ID, len(copyRegistrations))
	sources := make(map[string]module.ID, len(copyRegistrations))
	tables := make(map[string]module.ID, len(copyRegistrations))
	retiredTables := make(map[string]module.ID)
	for index, registration := range copyRegistrations {
		if !validModuleID(registration.ModuleID) {
			return Catalog{}, fmt.Errorf("migration registration %d module id %q is invalid", index, registration.ModuleID)
		}
		if _, exists := modules[registration.ModuleID]; exists {
			return Catalog{}, fmt.Errorf("migration module %q is duplicated", registration.ModuleID)
		}
		modules[registration.ModuleID] = struct{}{}
		if strings.TrimSpace(registration.Source) != registration.Source || registration.Source == "" {
			return Catalog{}, fmt.Errorf("migration module %q source is required", registration.ModuleID)
		}
		if owner, exists := sources[registration.Source]; exists {
			return Catalog{}, fmt.Errorf("migration source %q is shared by modules %q and %q", registration.Source, owner, registration.ModuleID)
		}
		sources[registration.Source] = registration.ModuleID
		if err := dbmigrate.ValidateSet(registration.Set); err != nil {
			return Catalog{}, fmt.Errorf("migration module %q set: %w", registration.ModuleID, err)
		}
		if strings.TrimSpace(registration.Set.Name) != registration.Set.Name {
			return Catalog{}, fmt.Errorf("migration module %q set name %q is invalid", registration.ModuleID, registration.Set.Name)
		}
		if owner, exists := sets[registration.Set.Name]; exists {
			return Catalog{}, fmt.Errorf("migration set %q is shared by modules %q and %q", registration.Set.Name, owner, registration.ModuleID)
		}
		sets[registration.Set.Name] = registration.ModuleID
		table := strings.TrimSpace(registration.Set.MigrationsTable)
		if table == "" || table != registration.Set.MigrationsTable || !validTableName(table) {
			return Catalog{}, fmt.Errorf("migration module %q must own an explicit version table", registration.ModuleID)
		}
		if owner, exists := tables[table]; exists {
			return Catalog{}, fmt.Errorf("migration version table %q is shared by modules %q and %q", table, owner, registration.ModuleID)
		}
		tables[table] = registration.ModuleID
		seenRetired := make(map[string]struct{}, len(registration.RetiredTables))
		for _, retired := range registration.RetiredTables {
			if strings.TrimSpace(retired) != retired || !validTableName(retired) || retired == table {
				return Catalog{}, fmt.Errorf("migration module %q retired table %q is invalid", registration.ModuleID, retired)
			}
			if _, exists := seenRetired[retired]; exists {
				return Catalog{}, fmt.Errorf("migration module %q duplicates retired table %q", registration.ModuleID, retired)
			}
			seenRetired[retired] = struct{}{}
			if owner, exists := retiredTables[retired]; exists {
				return Catalog{}, fmt.Errorf("migration retired table %q is shared by modules %q and %q", retired, owner, registration.ModuleID)
			}
			retiredTables[retired] = registration.ModuleID
		}
	}
	return Catalog{registrations: copyRegistrations}, nil
}

// Registrations 返回稳定排序的深副本。
func (catalog Catalog) Registrations() []Registration {
	result := make([]Registration, len(catalog.registrations))
	for index, registration := range catalog.registrations {
		result[index] = cloneRegistration(registration)
	}
	return result
}

func cloneRegistration(registration Registration) Registration {
	registration.Set.DriverPaths = cloneMap(registration.Set.DriverPaths)
	registration.Set.SHA256ByFile = cloneMap(registration.Set.SHA256ByFile)
	registration.RetiredTables = append([]string(nil), registration.RetiredTables...)
	return registration
}

func cloneMap[K comparable, V any](source map[K]V) map[K]V {
	result := make(map[K]V, len(source))
	for key, value := range source {
		result[key] = value
	}
	return result
}

func validModuleID(value module.ID) bool {
	text := string(value)
	if text == "" || text[0] < 'a' || text[0] > 'z' {
		return false
	}
	for _, character := range text {
		if (character < 'a' || character > 'z') && (character < '0' || character > '9') && character != '-' && character != '_' {
			return false
		}
	}
	return true
}

func validTableName(value string) bool {
	if len(value) == 0 || len(value) > 63 || value[0] != '_' && (value[0] < 'A' || value[0] > 'Z') && (value[0] < 'a' || value[0] > 'z') {
		return false
	}
	for _, character := range value[1:] {
		if character != '_' && (character < 'A' || character > 'Z') && (character < 'a' || character > 'z') && (character < '0' || character > '9') {
			return false
		}
	}
	return true
}
