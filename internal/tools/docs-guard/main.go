// docs-guard 校验当前文档的链接、索引和可达性，不要求每次变更建立任务账本。
package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"go.yaml.in/yaml/v3"
)

type config struct {
	SchemaVersion   int             `yaml:"schema_version"`
	Entrypoints     entrypoints     `yaml:"entrypoints"`
	HistoryRoots    []string        `yaml:"history_roots"`
	ExcludedRoots   []string        `yaml:"excluded_roots"`
	RequiredDocs    []string        `yaml:"required_documents"`
	RequiredIndexes []requiredIndex `yaml:"required_indexes"`
}

type entrypoints struct {
	Root     string `yaml:"root"`
	Handbook string `yaml:"handbook"`
}

type requiredIndex struct {
	Root     string `yaml:"root"`
	Index    string `yaml:"index"`
	Children bool   `yaml:"children"`
}

type link struct {
	From   string
	Target string
}

var markdownLink = regexp.MustCompile(`\[[^\]]+\]\(\s*([^\s)]+)(?:\s+[^)]*)?\)`)
var heading = regexp.MustCompile(`^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$`)

func main() {
	var configPath string
	flag.StringVar(&configPath, "config", "docs/documentation.yaml", "文档治理配置路径")
	flag.Parse()

	root, err := os.Getwd()
	if err != nil {
		fail(err)
	}
	cfg, err := loadConfig(root, configPath)
	if err != nil {
		fail(err)
	}
	issues := append([]string{}, staticIssues(root, cfg)...)
	if len(issues) > 0 {
		fmt.Fprintln(os.Stderr, "docs-guard failed:")
		for _, issue := range issues {
			fmt.Fprintf(os.Stderr, "- %s\n", issue)
		}
		os.Exit(1)
	}
	fmt.Println("docs-guard passed: current documentation links, indexes and reachability are valid")
}

func loadConfig(root, path string) (config, error) {
	if !filepath.IsAbs(path) {
		path = filepath.Join(root, filepath.FromSlash(path))
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return config{}, fmt.Errorf("read config %s: %w", path, err)
	}
	var cfg config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return config{}, fmt.Errorf("parse config %s: %w", path, err)
	}
	if cfg.SchemaVersion != 1 {
		return config{}, fmt.Errorf("unsupported documentation config schema_version %d", cfg.SchemaVersion)
	}
	if cfg.Entrypoints.Root == "" || cfg.Entrypoints.Handbook == "" {
		return config{}, errors.New("documentation config must define root and handbook entrypoints")
	}
	return cfg, nil
}

func staticIssues(root string, cfg config) []string {
	var issues []string
	for _, path := range cfg.RequiredDocs {
		if !exists(root, path) {
			issues = append(issues, fmt.Sprintf("required document is missing: %s", path))
		}
	}
	for _, item := range cfg.RequiredIndexes {
		issues = append(issues, indexIssues(root, item)...)
	}
	files, scanErr := markdownFiles(root, cfg)
	if scanErr != nil {
		issues = append(issues, fmt.Sprintf("scan current documentation: %v", scanErr))
	}
	graph := map[string][]string{}
	for _, file := range files {
		links, err := parseLinks(root, file)
		if err != nil {
			issues = append(issues, err.Error())
			continue
		}
		for _, item := range links {
			resolved, fragment, err := resolveTarget(root, item.From, item.Target)
			if err != nil {
				issues = append(issues, err.Error())
				continue
			}
			if resolved == "" {
				continue
			}
			if isExcluded(root, resolved, cfg.ExcludedRoots) {
				issues = append(issues, fmt.Sprintf("authority link enters excluded root %s: %s -> %s", rel(root, item.From), item.Target, rel(root, resolved)))
				continue
			}
			if fragment != "" && !hasAnchor(resolved, fragment) {
				issues = append(issues, fmt.Sprintf("invalid anchor %q: %s -> %s", fragment, rel(root, item.From), item.Target))
			}
			graph[rel(root, item.From)] = append(graph[rel(root, item.From)], rel(root, resolved))
		}
	}
	issues = append(issues, reachabilityIssues(root, cfg, graph)...)
	return unique(issues)
}

func indexIssues(root string, item requiredIndex) []string {
	var issues []string
	indexPath := filepath.Join(root, filepath.FromSlash(item.Index))
	if !exists(root, item.Index) {
		return []string{fmt.Sprintf("required index is missing: %s", item.Index)}
	}
	if !item.Children {
		return nil
	}
	entries, err := os.ReadDir(filepath.Join(root, filepath.FromSlash(item.Root)))
	if err != nil {
		return []string{fmt.Sprintf("read indexed root %s: %v", item.Root, err)}
	}
	links, err := parseLinks(root, indexPath)
	if err != nil {
		return []string{err.Error()}
	}
	linked := map[string]bool{}
	for _, itemLink := range links {
		resolved, _, resolveErr := resolveTarget(root, itemLink.From, itemLink.Target)
		if resolveErr == nil && resolved != "" {
			linked[rel(root, resolved)] = true
		}
	}
	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		readme := filepath.ToSlash(filepath.Join(item.Root, entry.Name(), "README.md"))
		if !exists(root, readme) {
			issues = append(issues, fmt.Sprintf("indexed directory is missing README.md: %s", filepath.ToSlash(filepath.Join(item.Root, entry.Name()))))
			continue
		}
		if !linked[readme] {
			issues = append(issues, fmt.Sprintf("indexed README is not linked from %s: %s", item.Index, readme))
		}
	}
	return issues
}

func reachabilityIssues(root string, cfg config, graph map[string][]string) []string {
	start := rel(root, filepath.Join(root, filepath.FromSlash(cfg.Entrypoints.Root)))
	seen := map[string]bool{start: true}
	queue := []string{start}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		for _, next := range graph[current] {
			if !seen[next] {
				seen[next] = true
				queue = append(queue, next)
			}
		}
	}
	var issues []string
	for _, required := range cfg.RequiredDocs {
		if !seen[filepath.ToSlash(filepath.Clean(required))] {
			issues = append(issues, fmt.Sprintf("required document is unreachable from %s: %s", cfg.Entrypoints.Root, required))
		}
	}
	return issues
}

func markdownFiles(root string, cfg config) ([]string, error) {
	var files []string
	walkErr := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			if path != root && isGeneratedDir(entry.Name()) {
				return filepath.SkipDir
			}
			if path != root && isExcluded(root, path, append(cfg.ExcludedRoots, cfg.HistoryRoots...)) {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.EqualFold(filepath.Ext(path), ".md") && !isExcluded(root, path, cfg.ExcludedRoots) && !isUnderAny(root, path, cfg.HistoryRoots) {
			files = append(files, path)
		}
		return nil
	})
	sort.Strings(files)
	return files, walkErr
}

func parseLinks(root, path string) ([]link, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read markdown %s: %w", rel(root, path), err)
	}
	var links []link
	inFence := false
	for _, line := range strings.Split(string(data), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "```") || strings.HasPrefix(trimmed, "~~~") {
			inFence = !inFence
			continue
		}
		if inFence {
			continue
		}
		for _, positions := range markdownLink.FindAllStringSubmatchIndex(line, -1) {
			if len(positions) != 4 || isInsideInlineCode(line, positions[0]) {
				continue
			}
			target := line[positions[2]:positions[3]]
			links = append(links, link{From: path, Target: strings.Trim(target, "<>")})
		}
	}
	return links, nil
}

func isInsideInlineCode(line string, position int) bool {
	backticks := 0
	for index := 0; index < position && index < len(line); index++ {
		if line[index] == '`' {
			backticks++
		}
	}
	return backticks%2 == 1
}

func isGeneratedDir(name string) bool {
	switch name {
	case ".git", ".tools", ".data", ".next", ".nuxt", ".output", ".pnpm-store", "coverage", "test-results", "playwright-report", "dist", "node_modules":
		return true
	default:
		return false
	}
}

func resolveTarget(root, from, target string) (string, string, error) {
	if target == "" || strings.HasPrefix(target, "//") || strings.Contains(target, "://") || strings.HasPrefix(target, "mailto:") {
		return "", "", nil
	}
	if strings.HasPrefix(target, "#") {
		return from, strings.TrimPrefix(target, "#"), nil
	}
	parts := strings.SplitN(target, "#", 2)
	pathPart := parts[0]
	fragment := ""
	if len(parts) == 2 {
		fragment = parts[1]
	}
	pathPart = strings.TrimSpace(pathPart)
	var candidate string
	if strings.HasPrefix(pathPart, "/") {
		candidate = filepath.Join(root, filepath.FromSlash(strings.TrimPrefix(pathPart, "/")))
	} else {
		candidate = filepath.Join(filepath.Dir(from), filepath.FromSlash(pathPart))
	}
	candidate = filepath.Clean(candidate)
	if !within(root, candidate) {
		return "", "", fmt.Errorf("markdown link escapes repository: %s -> %s", rel(root, from), target)
	}
	info, err := os.Stat(candidate)
	if err != nil {
		return "", "", fmt.Errorf("broken markdown link: %s -> %s", rel(root, from), target)
	}
	if info.IsDir() {
		candidate = filepath.Join(candidate, "README.md")
		if _, err := os.Stat(candidate); err != nil {
			return "", "", fmt.Errorf("directory link has no README.md: %s -> %s", rel(root, from), target)
		}
	}
	return candidate, fragment, nil
}

func hasAnchor(path, wanted string) bool {
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	anchors := map[string]bool{}
	for _, line := range strings.Split(string(data), "\n") {
		match := heading.FindStringSubmatch(line)
		if len(match) == 2 {
			anchors[slug(match[1])] = true
		}
	}
	return anchors[strings.ToLower(strings.TrimSpace(wanted))]
}

func slug(value string) string {
	value = strings.TrimSpace(strings.Trim(value, "`"))
	var out []rune
	lastDash := false
	for _, r := range strings.ToLower(value) {
		if r == '`' || r == '*' || r == '_' {
			continue
		}
		if r == ' ' || r == '\t' || r == '-' {
			if !lastDash {
				out = append(out, '-')
				lastDash = true
			}
			continue
		}
		out = append(out, r)
		lastDash = false
	}
	return strings.Trim(string(out), "-")
}

func exists(root, path string) bool {
	_, err := os.Stat(filepath.Join(root, filepath.FromSlash(path)))
	return err == nil
}

func within(root, target string) bool {
	relPath, err := filepath.Rel(root, target)
	return err == nil && relPath != ".." && !strings.HasPrefix(relPath, ".."+string(filepath.Separator))
}

func isExcluded(root, path string, roots []string) bool {
	return isUnderAny(root, path, roots)
}

func isUnderAny(root, path string, roots []string) bool {
	pathRel := filepath.ToSlash(rel(root, path))
	for _, excluded := range roots {
		excluded = strings.TrimSuffix(filepath.ToSlash(excluded), "/")
		if pathRel == excluded || strings.HasPrefix(pathRel, excluded+"/") {
			return true
		}
	}
	return false
}

func rel(root, path string) string {
	value, err := filepath.Rel(root, path)
	if err != nil {
		return filepath.ToSlash(path)
	}
	return filepath.ToSlash(value)
}

func unique(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	sort.Strings(result)
	return result
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "docs-guard:", err)
	os.Exit(2)
}
