// Command project-layout 校验构建期布局与身份 metadata 的一致性。
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"github.com/reina0721/clouddrive/internal/kernel/cli"
	"github.com/reina0721/clouddrive/internal/projectlayout"
)

func main() {
	checkIdentity := flag.Bool("check-identity", false, "校验 identity config_filename 与应用默认配置路径一致")
	checkWebUI := flag.Bool("check-webui", false, "校验 webui 托管默认值与布局清单一致")
	flag.Parse()
	root, layout, err := projectlayout.FindRepositoryRootFromCurrentDirectory()
	if err != nil {
		fail(err)
	}
	if *checkIdentity {
		if err := validateIdentity(root); err != nil {
			fail(err)
		}
	}
	if *checkWebUI {
		if err := validateWebUI(root, layout); err != nil {
			fail(err)
		}
	}
}

func validateIdentity(repositoryRoot string) error {
	content, err := os.ReadFile(filepath.Join(repositoryRoot, ".scaffold", "identity.yaml"))
	if err != nil {
		return fmt.Errorf("read identity metadata: %w", err)
	}
	match := regexp.MustCompile(`(?m)^\s*config_filename:\s*(\S+)\s*$`).FindSubmatch(content)
	if len(match) != 2 {
		return fmt.Errorf("identity metadata config_filename is missing")
	}
	if string(match[1]) != cli.DefaultConfigPath {
		return fmt.Errorf("identity config_filename %q differs from application default %q", match[1], cli.DefaultConfigPath)
	}
	return nil
}

// validateWebUI 验证唯一前端工作区的入口与锁文件。
func validateWebUI(repositoryRoot string, layout projectlayout.Layout) error {
	for _, relative := range []string{layout.Roots.WebUI + "/package.json", layout.Roots.WebUI + "/pnpm-lock.yaml", layout.Roots.WebUI + "/apps/web/next.config.ts"} {
		if _, err := os.Stat(filepath.Join(repositoryRoot, relative)); err != nil {
			return err
		}
	}
	return nil
}

func fail(err error) {
	_, _ = fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
