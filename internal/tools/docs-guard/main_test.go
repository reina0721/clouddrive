package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseLinksIgnoresCodeAndInlineCode(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "README.md")
	content := "[valid](docs/README.md)\n`[inline](missing.md)`\n\n```text\n[code](missing-code.md)\n```\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	links, err := parseLinks(root, path)
	if err != nil {
		t.Fatal(err)
	}
	if len(links) != 1 || links[0].Target != "docs/README.md" {
		t.Fatalf("links = %#v, want only valid link", links)
	}
}

func TestStaticIssuesDetectBrokenAndUnreachableDocuments(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, "README.md", "[handbook](docs/README.md)\n[broken](missing.md)\n")
	writeFile(t, root, "docs/README.md", "# handbook\n")
	writeFile(t, root, "docs/required.md", "# required\n")
	cfg := config{
		SchemaVersion: 1,
		Entrypoints:   entrypoints{Root: "README.md", Handbook: "docs/README.md"},
		RequiredDocs:  []string{"README.md", "docs/README.md", "docs/required.md"},
	}
	issues := staticIssues(root, cfg)
	joined := strings.Join(issues, "\n")
	if !strings.Contains(joined, "broken markdown link") {
		t.Fatalf("issues did not contain broken link: %s", joined)
	}
	if !strings.Contains(joined, "required document is unreachable") {
		t.Fatalf("issues did not contain unreachable document: %s", joined)
	}
}

func TestIndexIssuesRequireReadmeAndIndexLink(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, "pkg/README.md", "[one](one/README.md)\n")
	if err := os.MkdirAll(filepath.Join(root, "pkg", "one"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "pkg", "two"), 0o700); err != nil {
		t.Fatal(err)
	}
	writeFile(t, root, "pkg/one/README.md", "# one\n")
	cfg := requiredIndex{Root: "pkg", Index: "pkg/README.md", Children: true}
	issues := indexIssues(root, cfg)
	joined := strings.Join(issues, "\n")
	if !strings.Contains(joined, "pkg/two") || !strings.Contains(joined, "missing README.md") {
		t.Fatalf("issues = %s", joined)
	}
}

func TestAnchorSlug(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "README.md")
	writeFile(t, root, "README.md", "# 全栈 WebUI 本地启动\n")
	if !hasAnchor(path, "全栈-webui-本地启动") {
		t.Fatalf("expected heading anchor to resolve")
	}
}

// TestStaticIssuesWithoutChangeHistory 验证无任务历史目录时的当前文档拓扑。
func TestStaticIssuesWithoutChangeHistory(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, "README.md", "[手册](docs/README.md)\n")
	writeFile(t, root, "docs/README.md", "# 手册\n")
	writeFile(t, root, ".tools/README.md", "[工具内部链接](not-in-repository.md)\n")
	cfg := config{SchemaVersion: 1, Entrypoints: entrypoints{Root: "README.md", Handbook: "docs/README.md"}, RequiredDocs: []string{"README.md", "docs/README.md"}}
	if issues := staticIssues(root, cfg); len(issues) != 0 {
		t.Fatalf("unexpected issues: %v", issues)
	}
}

func writeFile(t *testing.T, root, name, content string) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(name))
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}
