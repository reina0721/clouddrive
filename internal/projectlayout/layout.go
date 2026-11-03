// Package projectlayout 定义构建工具共享的仓库布局契约。
package projectlayout

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const (
	// DefaultManifestPath 是开发工具寻找布局清单时唯一固定的 bootstrap 路径。
	DefaultManifestPath  = ".scaffold/layout.json"
	currentSchemaVersion = 1
)

// Layout 描述不应散落在各工具中的仓库构建路径。
type Layout struct {
	SchemaVersion      int                `json:"schemaVersion"`
	Roots              Roots              `json:"roots"`
	WebUI              WebUILayout        `json:"webui"`
	GeneratedArtifacts GeneratedArtifacts `json:"generatedArtifacts"`
}

// Roots 描述仓库级目录。
type Roots struct {
	WebUI   string `json:"webui"`
	Modules string `json:"modules"`
	Tools   string `json:"tools"`
	Release string `json:"release"`
}

// WebUILayout 描述 WebUI 与业务模块 WebUI 的关系。
type WebUILayout struct {
	ModuleFacet    string `json:"moduleFacet"`
	Source         string `json:"source"`
	PlatformStyles string `json:"platformStyles"`
	RegistryOutput string `json:"registryOutput"`
	// SpecOutput 是 contract 浏览器快照（openapi-spec.ts）的生成路径（075）。
	SpecOutput string `json:"specOutput"`
}

// GeneratedArtifacts 描述代码生成器的默认输出。
type GeneratedArtifacts struct {
	OpenAPI            string `json:"openapi"`
	OperationInventory string `json:"operationInventory"`
}

// Load 从指定仓库根读取并严格校验 layout manifest。
func Load(repositoryRoot, manifestPath string) (Layout, error) {
	root, err := filepath.Abs(repositoryRoot)
	if err != nil {
		return Layout{}, fmt.Errorf("resolve repository root: %w", err)
	}
	if strings.TrimSpace(manifestPath) == "" {
		manifestPath = filepath.Join(root, filepath.FromSlash(DefaultManifestPath))
	} else if !filepath.IsAbs(manifestPath) {
		manifestPath = filepath.Join(root, filepath.FromSlash(manifestPath))
	}
	content, err := os.ReadFile(manifestPath)
	if err != nil {
		return Layout{}, fmt.Errorf("read project layout %q: %w", filepath.ToSlash(manifestPath), err)
	}
	decoder := json.NewDecoder(bytes.NewReader(content))
	decoder.DisallowUnknownFields()
	var layout Layout
	if err := decoder.Decode(&layout); err != nil {
		return Layout{}, fmt.Errorf("decode project layout: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		if err == nil {
			return Layout{}, fmt.Errorf("decode project layout: trailing JSON value")
		}
		return Layout{}, fmt.Errorf("decode project layout: trailing data: %w", err)
	}
	if err := layout.Validate(root); err != nil {
		return Layout{}, err
	}
	return layout, nil
}

// FindRepositoryRoot 从 start 向上寻找唯一的布局 bootstrap 文件。
// 只有存在并通过校验的 manifest 才能确定仓库根，避免依赖当前工作目录中的目录猜测。
func FindRepositoryRoot(start string) (string, Layout, error) {
	candidate, err := filepath.Abs(start)
	if err != nil {
		return "", Layout{}, fmt.Errorf("resolve layout search path: %w", err)
	}
	if info, statErr := os.Stat(candidate); statErr == nil && !info.IsDir() {
		candidate = filepath.Dir(candidate)
	}
	for {
		manifestPath := filepath.Join(candidate, filepath.FromSlash(DefaultManifestPath))
		if _, statErr := os.Stat(manifestPath); statErr == nil {
			layout, loadErr := Load(candidate, "")
			if loadErr != nil {
				return "", Layout{}, loadErr
			}
			return candidate, layout, nil
		} else if !os.IsNotExist(statErr) {
			return "", Layout{}, fmt.Errorf("stat project layout %q: %w", manifestPath, statErr)
		}
		parent := filepath.Dir(candidate)
		if parent == candidate {
			break
		}
		candidate = parent
	}
	return "", Layout{}, fmt.Errorf("project layout %q was not found from %q", DefaultManifestPath, start)
}

// FindRepositoryRootFromCurrentDirectory 从当前目录寻找仓库布局。
func FindRepositoryRootFromCurrentDirectory() (string, Layout, error) {
	workingDirectory, err := os.Getwd()
	if err != nil {
		return "", Layout{}, fmt.Errorf("resolve current directory: %w", err)
	}
	return FindRepositoryRoot(workingDirectory)
}

// Validate 校验 schema、路径格式和仓库内的 owner 关系。
func (l Layout) Validate(repositoryRoot string) error {
	if l.SchemaVersion != currentSchemaVersion {
		return fmt.Errorf("project layout schema version %d is unsupported", l.SchemaVersion)
	}
	root, err := filepath.Abs(repositoryRoot)
	if err != nil {
		return fmt.Errorf("resolve repository root: %w", err)
	}
	for name, value := range map[string]string{
		"roots.webui": l.Roots.WebUI, "roots.modules": l.Roots.Modules,
		"roots.tools": l.Roots.Tools, "roots.release": l.Roots.Release,
		"webui.moduleFacet": l.WebUI.ModuleFacet, "webui.source": l.WebUI.Source,
		"webui.platformStyles": l.WebUI.PlatformStyles, "webui.registryOutput": l.WebUI.RegistryOutput,
		"webui.specOutput":                      l.WebUI.SpecOutput,
		"generatedArtifacts.openapi":            l.GeneratedArtifacts.OpenAPI,
		"generatedArtifacts.operationInventory": l.GeneratedArtifacts.OperationInventory,
	} {
		if _, err := cleanRelativePath(name, value); err != nil {
			return err
		}
	}
	if sameOrNested(l.Roots.WebUI, l.Roots.Modules) || sameOrNested(l.Roots.WebUI, l.Roots.Tools) || sameOrNested(l.Roots.WebUI, l.Roots.Release) ||
		sameOrNested(l.Roots.Modules, l.Roots.Tools) || sameOrNested(l.Roots.Modules, l.Roots.Release) || sameOrNested(l.Roots.Tools, l.Roots.Release) {
		return fmt.Errorf("project layout roots overlap")
	}
	if !isWithin(l.WebUI.Source, l.Roots.WebUI) {
		return fmt.Errorf("webui.source %q is outside roots.webui %q", l.WebUI.Source, l.Roots.WebUI)
	}
	if !isWithin(l.WebUI.PlatformStyles, l.Roots.WebUI) {
		return fmt.Errorf("webui.platformStyles %q is outside roots.webui %q", l.WebUI.PlatformStyles, l.Roots.WebUI)
	}
	if !isWithin(l.WebUI.RegistryOutput, l.Roots.WebUI) {
		return fmt.Errorf("webui.registryOutput %q is outside roots.webui %q", l.WebUI.RegistryOutput, l.Roots.WebUI)
	}
	if !isWithin(l.WebUI.SpecOutput, l.Roots.WebUI) {
		return fmt.Errorf("webui.specOutput %q is outside roots.webui %q", l.WebUI.SpecOutput, l.Roots.WebUI)
	}
	for name, relative := range map[string]string{"roots.webui": l.Roots.WebUI, "roots.modules": l.Roots.Modules} {
		absolute, err := l.RepositoryPath(root, relative)
		if err != nil {
			return err
		}
		info, err := os.Stat(absolute)
		if err != nil {
			return fmt.Errorf("stat %s %q: %w", name, relative, err)
		}
		if !info.IsDir() {
			return fmt.Errorf("%s %q is not a directory", name, relative)
		}
	}
	return nil
}

// RepositoryPath resolves a validated repository-relative path.
func (l Layout) RepositoryPath(repositoryRoot, relative string) (string, error) {
	cleaned, err := cleanRelativePath("path", relative)
	if err != nil {
		return "", err
	}
	root, err := filepath.Abs(repositoryRoot)
	if err != nil {
		return "", fmt.Errorf("resolve repository root: %w", err)
	}
	return filepath.Join(root, filepath.FromSlash(cleaned)), nil
}

// ModuleWebRoot returns the owned WebUI facet for a module.
func (l Layout) ModuleWebRoot(repositoryRoot, moduleID string) (string, error) {
	if strings.TrimSpace(moduleID) == "" || strings.ContainsAny(moduleID, `/\\`) || moduleID == "." || moduleID == ".." {
		return "", fmt.Errorf("module id %q is invalid for project layout", moduleID)
	}
	return l.RepositoryPath(repositoryRoot, l.Roots.Modules+"/"+moduleID+"/"+l.WebUI.ModuleFacet)
}

func cleanRelativePath(field, value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || strings.Contains(value, "\\") || filepath.IsAbs(value) || strings.HasPrefix(value, "//") {
		return "", fmt.Errorf("project layout %s must be a non-empty repository-relative path using '/'", field)
	}
	parts := strings.Split(value, "/")
	for _, part := range parts {
		if part == "" || part == "." || part == ".." {
			return "", fmt.Errorf("project layout %s contains an invalid path segment", field)
		}
	}
	return strings.Join(parts, "/"), nil
}

func isWithin(path, root string) bool {
	cleanPath, err := cleanRelativePath("path", path)
	if err != nil {
		return false
	}
	cleanRoot, err := cleanRelativePath("root", root)
	if err != nil {
		return false
	}
	return cleanPath == cleanRoot || strings.HasPrefix(cleanPath, cleanRoot+"/")
}

func sameOrNested(left, right string) bool {
	return isWithin(left, right) || isWithin(right, left)
}
