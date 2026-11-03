// Package consolecatalog 适配 console-web 生成的真实菜单目录。
package consolecatalog

import (
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/navigation/model"
	"github.com/reina0721/clouddrive/internal/module/navigation/service"
	"sort"
	"strings"
)

//go:embed catalog.json
var source []byte

type Catalog struct{ snapshot service.CatalogSnapshot }

func New() (*Catalog, error) {
	var definitions []model.Definition
	if err := json.Unmarshal(source, &definitions); err != nil {
		return nil, err
	}
	hash := sha256.Sum256(source)
	return &Catalog{snapshot: service.CatalogSnapshot{Revision: hex.EncodeToString(hash[:]), Definitions: definitions}}, nil
}
func (c *Catalog) Snapshot() service.CatalogSnapshot {
	return service.CatalogSnapshot{Revision: c.snapshot.Revision, Definitions: append([]model.Definition(nil), c.snapshot.Definitions...)}
}
func (c *Catalog) Validate(snapshot service.CatalogSnapshot, policies []model.Policy) (string, error) {
	if snapshot.Revision != c.snapshot.Revision {
		return "", model.ErrCatalogChanged
	}
	parents := map[string]string{}
	for _, definition := range snapshot.Definitions {
		parents[definition.ID] = definition.DefaultParentID
	}
	for _, policy := range policies {
		if _, ok := parents[policy.NavigationID]; !ok {
			return "", model.ErrUnknown
		}
		if err := model.ValidatePolicy(policy); err != nil {
			return "", err
		}
		if policy.ParentOverride != nil {
			parents[policy.NavigationID] = *policy.ParentOverride
		}
	}
	branches := map[string]bool{}
	for _, definition := range snapshot.Definitions {
		if definition.DefaultParentID != "" && !strings.HasPrefix(definition.DefaultParentID, "group:") {
			branches[definition.DefaultParentID] = true
		}
	}
	for id, parent := range parents {
		if strings.HasPrefix(id, "group:") {
			if parent != "" {
				return "", model.ErrInvalidParent
			}
		} else if parent == "" || (!strings.HasPrefix(parent, "group:") && (!branches[parent] || branches[id])) {
			return "", model.ErrInvalidParent
		}
	}
	for id := range parents {
		seen := map[string]bool{}
		current := id
		depth := 0
		for current != "" {
			if seen[current] {
				return "", model.ErrCycle
			}
			seen[current] = true
			parent, exists := parents[current]
			if !exists {
				return "", model.ErrInvalidParent
			}
			depth++
			if depth > 3 {
				return "", model.ErrInvalidParent
			}
			current = parent
		}
	}
	stable := append([]model.Policy(nil), policies...)
	sort.Slice(stable, func(i, j int) bool { return stable[i].NavigationID < stable[j].NavigationID })
	bytes, err := json.Marshal(stable)
	if err != nil {
		return "", fmt.Errorf("encode navigation policies: %w", err)
	}
	hash := sha256.Sum256(append([]byte(snapshot.Revision), bytes...))
	return hex.EncodeToString(hash[:]), nil
}
