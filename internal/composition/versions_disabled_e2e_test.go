package composition

import (
	"context"

	"github.com/reina0721/clouddrive/pkg/idgen"

	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestVersionsDisabledRetentionWebDAVReplacement(t *testing.T) {
	directory := t.TempDir()
	configPath := filepath.Join(directory, "config.yaml")
	setup, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	password, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	payload := "iam:\n  local:\n    setupToken: " + setup + "\n" + strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "disabled-history.db")), "mode: development-anonymous", "mode: session", 1)
	payload = strings.Replace(payload, "files:\n", "files:\n  history:\n    enabled: false\n", 1)
	writeGenerationConfig(t, configPath, payload)
	coordinator, _ := newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := coordinator.Stop(ctx); err != nil {
			t.Error(err)
		}
	}()
	owner := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	owner.request(t, "GET", "/auth/csrf", nil, 200)
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "annotation-owner@clouddrive.test", "name": "整理验收", "password": password}, 200)

	target := owner.request(t, "POST", "/native/files/text", map[string]string{"name": "target.txt", "parentId": "", "key": "disabled-target-fixture", "text": "longer target bytes"}, 200)["id"].(string)
	owner.request(t, "POST", "/native/files/text", map[string]string{"name": "source.txt", "parentId": "", "key": "disabled-source-fixture", "text": "abc"}, 200)
	credential := owner.request(t, "POST", "/native/files/connections", map[string]any{"name": "关闭保留测试", "rootId": "", "readOnly": false, "blockSystemFiles": true}, 200)
	davRequest(t, owner, credential, "COPY", "source.txt", nil, map[string]string{"Destination": owner.base + credential["endpointPath"].(string) + "target.txt", "Overwrite": "T"}, 204)
	history := owner.request(t, "GET", "/native/files/"+target+"/versions", nil, 200)
	if history["historyEnabled"] != false || history["total"] != float64(1) || history["ownerUsedBytes"] != float64(6) {
		t.Fatal("关闭保留的COPY替换语义错误")
	}
	davRequest(t, owner, credential, "PUT", "target.txt", strings.NewReader("z"), nil, 204)
	history = owner.request(t, "GET", "/native/files/"+target+"/versions", nil, 200)
	if history["total"] != float64(1) || history["ownerUsedBytes"] != float64(4) {
		t.Fatal("关闭保留的PUT替换语义错误")
	}
}
