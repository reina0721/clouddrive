package composition

import (
	"strings"
	"testing"
)

func TestWebDAVShortcutDoesNotAdvertiseUnsupportedLocks(t *testing.T) {
	owner, root, connection, _ := writeLockServer(t)
	file := owner.request(t, "POST", "/native/files/text", map[string]any{"name": "target.txt", "parentId": root, "text": "target", "key": "shortcut-lock-fixture"}, 200)
	share := owner.request(t, "POST", "/native/files/shares", map[string]any{"rootId": file["id"]}, 200)
	owner.request(t, "POST", "/native/files/shortcuts", map[string]any{"token": share["token"], "parentId": root, "name": "link"}, 200)
	properties, _ := davRequest(t, owner, connection, "PROPFIND", "link", strings.NewReader(`<propfind xmlns="DAV:"><prop><supportedlock/></prop></propfind>`), map[string]string{"Depth": "0"}, 207)
	if !strings.Contains(string(properties), "supportedlock") || strings.Contains(string(properties), "lockentry") {
		t.Fatal("快捷方式错误宣称支持写锁")
	}
	acquireDAVLock(t, owner, connection, "link", "0", 501)
}
