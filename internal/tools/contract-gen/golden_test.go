package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGeneratorMatchesCommittedArtifacts(t *testing.T) {
	root, err := filepath.Abs(filepath.Join("..", "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	openapi := filepath.Join(dir, "openapi.yaml")
	inventory := filepath.Join(dir, "operations.go")
	if err := run(openapi, inventory, "api"); err != nil {
		t.Fatal(err)
	}
	for _, pair := range [][2]string{{openapi, filepath.Join(root, "api", "openapi.yaml")}, {inventory, filepath.Join(root, "internal", "transport", "http", "api", "operation_inventory.gen.go")}} {
		generated, err := os.ReadFile(pair[0])
		if err != nil {
			t.Fatal(err)
		}
		committed, err := os.ReadFile(pair[1])
		if err != nil {
			t.Fatal(err)
		}
		if string(generated) != string(committed) {
			t.Errorf("generated artifact differs: %s", pair[1])
		}
	}
}
