package projectlayout

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestLoadRejectsUnknownFieldsAndUnsafePaths(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "webui", "src"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "internal", "module"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "webui", "src", "styles.css"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	valid := Layout{
		SchemaVersion:      1,
		Roots:              Roots{WebUI: "webui", Modules: "internal/module", Tools: ".tools/bin", Release: "dist"},
		WebUI:              WebUILayout{ModuleFacet: "binding/webui/web", Source: "webui/src", PlatformStyles: "webui/src/styles.css", RegistryOutput: "webui/src/generated/webui-registry.ts", SpecOutput: "webui/src/generated/openapi-spec.ts"},
		GeneratedArtifacts: GeneratedArtifacts{OpenAPI: "api/openapi.yaml", OperationInventory: "internal/transport/http/api/operation_inventory.gen.go"},
	}
	encoded, err := json.Marshal(valid)
	if err != nil {
		t.Fatal(err)
	}
	manifest := filepath.Join(root, "layout.json")
	if err := os.WriteFile(manifest, encoded, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(root, manifest); err != nil {
		t.Fatalf("Load(valid) error = %v", err)
	}
	unknown := string(encoded[:len(encoded)-1]) + `,"unexpected":"value"}`
	if err := os.WriteFile(manifest, []byte(unknown), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(root, manifest); err == nil {
		t.Fatal("Load(unknown field) error = nil")
	}
	unsafe := valid
	unsafe.Roots.WebUI = "../webui"
	encoded, err = json.Marshal(unsafe)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(manifest, encoded, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(root, manifest); err == nil {
		t.Fatal("Load(unsafe) error = nil")
	}
}

func TestModuleWebRootUsesDeclaredFacet(t *testing.T) {
	t.Parallel()
	layout := Layout{Roots: Roots{Modules: "src/apps"}, WebUI: WebUILayout{ModuleFacet: "ui/facet"}}
	want := filepath.Join("repo", "src", "apps", "catalog", "ui", "facet")
	want, err := filepath.Abs(want)
	if err != nil {
		t.Fatal(err)
	}
	got, err := layout.ModuleWebRoot("repo", "catalog")
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Clean(got) != filepath.Clean(want) {
		t.Fatalf("ModuleWebRoot() = %q, want %q", got, want)
	}
}
