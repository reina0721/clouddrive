package composition

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anacrolix/torrent/bencode"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

// torrentProtocolFixture 只验证产品事务与RPC边界，不作为真实peer交换的替代证据。
type torrentProtocolFixture struct {
	mu          sync.Mutex
	jobs        map[string]*torrentProtocolJob
	metadata    []byte
	hash        string
	root        string
	methods     []string
	unavailable bool
}
type torrentProtocolJob struct {
	GID          string `json:"gid"`
	Directory    string `json:"dir"`
	MetadataOnly string `json:"bt-metadata-only"`
	SelectFile   string `json:"select-file"`
	state        string
	completeAt   time.Time
}

func newTorrentProtocolFixture(t *testing.T) *torrentProtocolFixture {
	t.Helper()
	info, err := bencode.Marshal(map[string]any{"name": "bundle", "files": []any{map[string]any{"length": 4, "path": []string{"first.txt"}}, map[string]any{"length": 4, "path": []string{"sub", "second.txt"}}}, "piece length": 16384, "pieces": string(bytes.Repeat([]byte{1}, 20))})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := bencode.Marshal(map[string]any{"info": bencode.Bytes(info)})
	if err != nil {
		t.Fatal(err)
	}
	digest := sha1.Sum(info)
	return &torrentProtocolFixture{jobs: map[string]*torrentProtocolJob{}, metadata: raw, hash: hex.EncodeToString(digest[:]), root: filepath.Clean(t.TempDir())}
}

func (f *torrentProtocolFixture) handler(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			ID     uint64            `json:"id"`
			Method string            `json:"method"`
			Params []json.RawMessage `json:"params"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Error(err)
			w.WriteHeader(400)
			return
		}
		f.mu.Lock()
		defer f.mu.Unlock()
		f.methods = append(f.methods, request.Method)
		if f.unavailable {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		var result any = "OK"
		var failure any
		gid := ""
		if len(request.Params) > 1 && request.Method != "aria2.addTorrent" && request.Method != "aria2.addUri" {
			if err := json.Unmarshal(request.Params[1], &gid); err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
		}
		job := f.jobs[gid]
		switch request.Method {
		case "aria2.getVersion":
			result = map[string]any{"version": "1.37.0", "enabledFeatures": []string{"BitTorrent", "HTTPS"}}
		case "aria2.getSessionInfo":
			result = map[string]string{"sessionId": "1234567890abcdef"}
		case "aria2.getGlobalOption":
			result = map[string]string{"save-session": filepath.Join(f.root, "session"), "deferred-input": "false", "check-certificate": "true"}
		case "aria2.getGlobalStat":
			result = map[string]string{"downloadSpeed": "1024", "uploadSpeed": "512", "numActive": "2", "numWaiting": "3", "numStopped": "4"}
		case "aria2.saveSession":
		case "aria2.addTorrent", "aria2.addUri":
			var next torrentProtocolJob
			optionIndex := 3
			if request.Method == "aria2.addUri" {
				optionIndex = 2
			}
			if len(request.Params) <= optionIndex {
				t.Error("RPC缺少job选项")
				w.WriteHeader(400)
				return
			}
			if err := json.Unmarshal(request.Params[optionIndex], &next); err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			if filepath.Dir(next.Directory) != f.root || next.GID == "" || next.Directory != filepath.Join(f.root, next.GID) {
				t.Error("产品传入了非私有GID目录")
				w.WriteHeader(400)
				return
			}
			if _, err := os.Stat(next.Directory); err != nil {
				t.Error("Add前未准备job目录")
				w.WriteHeader(400)
				return
			}
			next.state = "paused"
			f.jobs[next.GID] = &next
			result = next.GID
		default:
			if job == nil {
				failure = map[string]any{"code": 1, "message": "GID " + gid + " is not found"}
				break
			}
			switch request.Method {
			case "aria2.getOption":
				if job.state == "complete" || job.state == "removed" {
					failure = map[string]any{"code": 1, "message": "Cannot get option for GID#" + gid}
				} else {
					result = map[string]string{"dir": job.Directory}
				}
			case "aria2.unpause":
				if job.MetadataOnly == "true" {
					if err := os.WriteFile(filepath.Join(job.Directory, f.hash+".torrent"), f.metadata, 0600); err != nil {
						t.Error(err)
						w.WriteHeader(500)
						return
					}
				} else {
					for index, name := range []string{"bundle/first.txt", "bundle/sub/second.txt"} {
						if !strings.Contains(","+job.SelectFile+",", ","+strconv.Itoa(index+1)+",") {
							continue
						}
						file := filepath.Join(job.Directory, filepath.FromSlash(name))
						if err := os.MkdirAll(filepath.Dir(file), 0700); err != nil {
							t.Error(err)
							w.WriteHeader(500)
							return
						}
						if err := os.WriteFile(file, []byte("real"), 0600); err != nil {
							t.Error(err)
							w.WriteHeader(500)
							return
						}
					}
				}
				job.state, result = "complete", gid
				if job.MetadataOnly == "true" {
					// 真实元数据可超过通用执行器的两秒预算；持久BT任务须继续同一次领取。
					job.state, job.completeAt = "active", time.Now().Add(2200*time.Millisecond)
				}
			case "aria2.pause":
				job.state, result = "paused", gid
			case "aria2.remove":
				job.state, result = "removed", gid
			case "aria2.removeDownloadResult":
				delete(f.jobs, gid)
			case "aria2.tellStatus":
				if job.state == "active" && !job.completeAt.IsZero() && !time.Now().Before(job.completeAt) {
					job.state = "complete"
				}
				files := []any{}
				completed := 0
				total := 8
				if job.MetadataOnly != "true" {
					total = 0
					for index, name := range []string{"bundle/first.txt", "bundle/sub/second.txt"} {
						selected := strings.Contains(","+job.SelectFile+",", ","+strconv.Itoa(index+1)+",")
						if selected {
							total += 4
							if job.state == "complete" {
								completed += 4
							}
						}
						files = append(files, map[string]string{"index": strconv.Itoa(index + 1), "path": filepath.Join(job.Directory, filepath.FromSlash(name)), "length": "4", "completedLength": "0", "selected": strconv.FormatBool(selected)})
					}
				}
				result = map[string]any{"gid": gid, "dir": job.Directory, "status": job.state, "infoHash": f.hash, "totalLength": strconv.Itoa(total), "completedLength": strconv.Itoa(completed), "downloadSpeed": "0", "files": files}
			default:
				t.Errorf("未预期的RPC方法: %s", request.Method)
				w.WriteHeader(400)
				return
			}
		}
		response := map[string]any{"jsonrpc": "2.0", "id": request.ID}
		if failure != nil {
			w.WriteHeader(http.StatusBadRequest)
			response["error"] = failure
		} else {
			response["result"] = result
		}
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Error(err)
		}
	}
}

func TestTorrentProductSelectionIsolationAndAtomicPublication(t *testing.T) {
	fixture := newTorrentProtocolFixture(t)
	t.Cleanup(func() {
		if t.Failed() {
			fixture.mu.Lock()
			defer fixture.mu.Unlock()
			t.Logf("协议方法轨迹: %v", fixture.methods)
		}
	})
	node := httptest.NewServer(fixture.handler(t))
	t.Cleanup(node.Close)
	directory := t.TempDir()
	setup, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	password, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	config := generationConfig(directory, 120, 32<<20, filepath.Join(directory, "torrent.db"))
	config = strings.Replace(config, "mode: development-anonymous", "mode: session", 1)
	config = strings.Replace(config, "scheduler:\n  enabled: false", "scheduler:\n  enabled: true", 1)
	config = strings.Replace(config, "files:\n", fmt.Sprintf("files:\n  maxFileBytes: 64\n  quotaBytes: 64\n  offline:\n    torrentNodes:\n      - id: local\n        name: 测试节点\n        endpoint: %s\n        secret: %s\n        workspaceRoot: %s\n", strconv.Quote(node.URL), strconv.Quote(setup), strconv.Quote(fixture.root)), 1)
	config = "iam:\n  local:\n    setupToken: " + setup + "\n" + config
	configPath := filepath.Join(directory, "config.yaml")
	writeGenerationConfig(t, configPath, config)
	coordinator, _ := newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := coordinator.Stop(ctx); err != nil {
			t.Error(err)
		}
	})
	owner := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	owner.request(t, "GET", "/auth/csrf", nil, 200)
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "torrent-owner@clouddrive.test", "name": "种子验收", "password": password}, 200)
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "Torrent users", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	owner.request(t, "PUT", "/native/iam/roles/"+role["id"].(string)+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	owner.request(t, "POST", "/users", map[string]any{"email": "torrent-other@clouddrive.test", "name": "独立账号", "password": password, "roleIds": []string{role["id"].(string)}, "status": "active"}, 200)
	other := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	other.request(t, "GET", "/auth/csrf", nil, 200)
	other.request(t, "POST", "/auth/login", map[string]string{"email": "torrent-other@clouddrive.test", "password": password}, 200)
	const nodePath = "/native/files/worker-nodes"
	other.request(t, "GET", nodePath, nil, 403)
	other.request(t, "GET", nodePath+"/local/check", nil, 403)
	nodes := owner.request(t, "GET", nodePath, nil, 200)
	if len(nodes["local"].([]any)) != 5 || len(nodes["nodes"].([]any)) != 1 || nodes["canReadTasks"] != true {
		t.Fatal("节点目录与权限投影不完整")
	}
	for _, endpoint := range []string{nodePath, nodePath + "/local/check"} {
		raw := audienceHTTP(t, owner, "GET", "/api/console/v1"+endpoint, nil, 200)
		for _, private := range []string{setup, fixture.root, node.URL, "1234567890abcdef"} {
			if bytes.Contains(raw, []byte(private)) {
				t.Fatal("节点管理响应披露内部字段")
			}
		}
	}
	check := owner.request(t, "GET", nodePath+"/local/check", nil, 200)
	if check["version"] != "1.37.0" || check["active"] != float64(2) || check["waiting"] != float64(3) ||
		check["stopped"] != float64(4) || check["downloadBytesPerSecond"] != float64(1024) || check["uploadBytesPerSecond"] != float64(512) {
		t.Fatal("实际 RPC 统计未完整投影")
	}
	owner.request(t, "GET", nodePath+"/unknown/check", nil, 404)
	fixture.mu.Lock()
	fixture.unavailable = true
	fixture.mu.Unlock()
	owner.request(t, "GET", nodePath+"/local/check", nil, 503)
	fixture.mu.Lock()
	fixture.unavailable = false
	fixture.mu.Unlock()
	capabilities := owner.request(t, "GET", "/native/files/torrent-downloads/capabilities", nil, 200)
	if capabilities["available"] != true || len(capabilities["nodes"].([]any)) != 1 {
		t.Fatal("节点能力未真实接入")
	}
	create := map[string]string{"torrentBase64": base64.StdEncoding.EncodeToString(fixture.metadata), "nodeId": "local", "clientKey": "torrent-product-fixture", "name": "", "parentId": ""}
	first := owner.request(t, "POST", "/native/files/torrent-downloads", create, 200)
	second := other.request(t, "POST", "/native/files/torrent-downloads", create, 200)
	if first["id"] == second["id"] || first["state"] != "selecting" {
		t.Fatal("同hash账号任务没有独立身份或虚构下载阶段")
	}
	const taskCatalog = "/native/files/admin-tasks"
	if tasks := owner.request(t, "GET", taskCatalog+"?nodeId=local&kind=bittorrent", nil, 200); tasks["total"] != float64(2) {
		t.Fatal("节点过滤未匹配真实节点任务")
	}
	if tasks := owner.request(t, "GET", taskCatalog+"?nodeId=unknown", nil, 200); tasks["total"] != float64(0) {
		t.Fatal("节点过滤包含其他节点任务")
	}
	const feedPath = "/native/files/background-tasks?kind=bittorrent&status=active"
	for _, account := range []struct {
		client *consoleTestClient
		task   map[string]any
	}{{owner, first}, {other, second}} {
		tasks := account.client.request(t, "GET", feedPath, nil, 200)["items"].([]any)
		if len(tasks) != 1 {
			t.Fatal("BitTorrent 汇总未按账号隔离")
		}
		item := tasks[0].(map[string]any)
		if item["id"] != account.task["id"] || item["kind"] != "bittorrent" || item["sourceName"] != account.task["name"] || item["state"] != "selecting" {
			t.Fatal("BitTorrent 汇总未保留真实任务名称、类型、身份或状态")
		}
	}
	path := "/native/files/downloads/" + first["id"].(string)
	selectionPath := "/native/files/torrent-downloads/" + first["id"].(string)
	other.request(t, "GET", selectionPath, nil, 404)
	other.request(t, "POST", path+"/cancel", map[string]any{"revision": first["revision"]}, 404)
	detail := owner.request(t, "GET", selectionPath, nil, 200)
	if len(detail["files"].([]any)) != 2 || detail["canSelect"] != true {
		t.Fatal("真实清单或选择准入丢失")
	}
	owner.request(t, "PATCH", selectionPath+"/selection", map[string]any{"revision": first["revision"], "indexes": []int{}}, 400)
	owner.request(t, "PATCH", selectionPath+"/selection", map[string]any{"revision": first["revision"], "indexes": []int{1, 1}}, 422)
	owner.request(t, "PATCH", selectionPath+"/selection", map[string]any{"revision": first["revision"], "indexes": []int{1}}, 200)
	owner.request(t, "PATCH", selectionPath+"/selection", map[string]any{"revision": first["revision"], "indexes": []int{2}}, 409)
	completed := waitDownloadState(t, owner, path, "completed")
	if completed["resultIsFolder"] != true || completed["selectedCount"] != float64(1) || completed["canCopySource"] != false {
		t.Fatal("结果目录、所选数量或种子来源语义错误")
	}
	encoded, err := json.Marshal(completed)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), fixture.root) || strings.Contains(string(encoded), setup) {
		t.Fatal("任务响应泄露节点凭据或路径")
	}
	resultID := completed["entryId"].(string)
	listing := owner.request(t, "GET", "/native/files?parent="+resultID, nil, 200)
	items := listing["items"].([]any)
	if len(items) != 1 {
		t.Fatal("未选文件被发布")
	}
	entryID := items[0].(map[string]any)["id"].(string)
	actual, _ := transferBytes(t, owner, "GET", "/files/"+entryID+"/content", nil, nil, 200)
	if string(actual) != "real" {
		t.Fatal("最终Storage字节与候选不一致")
	}
	other.request(t, "GET", "/native/files/"+resultID, nil, 404)
	// 发布完成后，调度器仍需清理节点任务和候选文件，清除记录使用清理后的版本。
	removable := waitDownloadStateWhen(t, owner, path, "completed", func(task map[string]any) bool {
		return task["cleanupPending"] == false
	})
	owner.request(t, "POST", path+"/remove", map[string]any{"revision": removable["revision"]}, 200)
	after, _ := transferBytes(t, owner, "GET", "/files/"+entryID+"/content", nil, nil, 200)
	if !bytes.Equal(actual, after) {
		t.Fatal("删除记录破坏已发布文件")
	}
	secondPath := "/native/files/downloads/" + second["id"].(string)
	canceled := other.request(t, "POST", secondPath+"/cancel", map[string]any{"revision": second["revision"]}, 200)
	if canceled["state"] != "canceled" {
		t.Fatal("未提交任务取消没有释放元数据")
	}
	// 磁力只获取元数据，选择前不能把虚拟metadata条目当作文件下载。
	magnet := other.request(t, "POST", "/native/files/torrent-downloads", map[string]string{"uri": "magnet:?xt=urn:btih:" + fixture.hash, "nodeId": "local", "clientKey": "torrent-magnet-fixture", "name": "", "parentId": ""}, 200)
	magnetPath := "/native/files/downloads/" + magnet["id"].(string)
	selecting := waitDownloadState(t, other, magnetPath, "selecting")
	fixture.mu.Lock()
	payloadJobs := 0
	for _, method := range fixture.methods {
		if method == "aria2.addTorrent" {
			payloadJobs++
		}
	}
	fixture.mu.Unlock()
	if payloadJobs != 1 || selecting["selectedCount"] != float64(0) {
		t.Fatal("元数据阶段提前创建了payload任务")
	}
	paused := other.request(t, "POST", magnetPath+"/pause", map[string]any{"revision": selecting["revision"]}, 200)
	if paused["state"] == "pausing" {
		paused = waitDownloadState(t, other, magnetPath, "paused")
	}
	retargeted := other.request(t, "PUT", magnetPath+"/target", map[string]any{"revision": paused["revision"], "parentId": "", "name": "renamed"}, 200)
	resumed := other.request(t, "POST", magnetPath+"/resume", map[string]any{"revision": retargeted["revision"]}, 200)
	if resumed["state"] != "selecting" {
		t.Fatal("元数据已就绪的恢复丢失选择阶段")
	}
	magnetSelection := "/native/files/torrent-downloads/" + magnet["id"].(string) + "/selection"
	other.request(t, "PATCH", magnetSelection, map[string]any{"revision": resumed["revision"], "indexes": []int{1, 2}}, 200)
	multi := waitDownloadState(t, other, magnetPath, "completed")
	if multi["selectedCount"] != float64(2) || multi["receivedBytes"] != float64(8) || multi["name"] != "renamed" {
		t.Fatal("多文件恢复后的计量或目标名称错误")
	}
	multiRoot := multi["entryId"].(string)
	rootEntries := other.request(t, "GET", "/native/files?parent="+multiRoot, nil, 200)["items"].([]any)
	if len(rootEntries) != 2 {
		t.Fatal("多文件发布未原子保留目录层次")
	}
	var subfolderID string
	for _, raw := range rootEntries {
		entry := raw.(map[string]any)
		if entry["name"] == "sub" {
			subfolderID = entry["id"].(string)
		}
	}
	if subfolderID == "" {
		t.Fatal("种子子目录丢失")
	}
	subEntries := other.request(t, "GET", "/native/files?parent="+subfolderID, nil, 200)["items"].([]any)
	if len(subEntries) != 1 || subEntries[0].(map[string]any)["name"] != "second.txt" {
		t.Fatal("第二个真实child未发布")
	}
	owner.request(t, "GET", "/native/files/"+multiRoot, nil, 404)

	// 配额按所选字节与本人已发布内容核算；拒绝选择不应创建child或占用磁盘。
	quotaSeed, err := bencode.Marshal(map[string]any{"info": map[string]any{"name": "quota.bin", "length": 57, "piece length": 16384, "pieces": strings.Repeat("a", 20)}})
	if err != nil {
		t.Fatal(err)
	}
	quotaTask := other.request(t, "POST", "/native/files/torrent-downloads", map[string]string{"torrentBase64": base64.StdEncoding.EncodeToString(quotaSeed), "nodeId": "local", "clientKey": "torrent-quota-fixture", "name": "", "parentId": ""}, 200)
	quotaPath := "/native/files/torrent-downloads/" + quotaTask["id"].(string)
	problem := other.request(t, "PATCH", quotaPath+"/selection", map[string]any{"revision": quotaTask["revision"], "indexes": []int{1}}, 409)
	if problem["code"] != "files_quota" || other.request(t, "GET", quotaPath, nil, 200)["canSelect"] != true {
		t.Fatal("选中文件未按本人剩余配额准入")
	}

	// 文件目录在任务创建后加锁；最终事务必须拒绝所有候选一起发布。
	scopeID := owner.request(t, "POST", "/native/files/folders", map[string]string{"name": "lock-scope", "parentId": ""}, 200)["id"].(string)
	lockedID := owner.request(t, "POST", "/native/files/folders", map[string]string{"name": "destination", "parentId": scopeID}, 200)["id"].(string)
	connection := owner.request(t, "POST", "/native/files/connections", map[string]any{"name": "torrent-lock-test", "rootId": scopeID, "readOnly": false, "blockSystemFiles": true}, 200)
	locked := owner.request(t, "POST", "/native/files/torrent-downloads", map[string]string{"torrentBase64": base64.StdEncoding.EncodeToString(fixture.metadata), "nodeId": "local", "clientKey": "torrent-locked-fixture", "name": "", "parentId": lockedID}, 200)
	token := acquireDAVLock(t, owner, connection, "destination", "infinity", 200)
	lockedIDPath := "/native/files/downloads/" + locked["id"].(string)
	owner.request(t, "PATCH", "/native/files/torrent-downloads/"+locked["id"].(string)+"/selection", map[string]any{"revision": locked["revision"], "indexes": []int{1, 2}}, 200)
	blocked := waitDownloadState(t, owner, lockedIDPath, "failed")
	if blocked["failureCode"] != "write-locked" || blocked["entryId"] != "" || len(owner.request(t, "GET", "/native/files?parent="+lockedID, nil, 200)["items"].([]any)) != 0 {
		t.Fatal("写锁没有阻止整批发布")
	}
	davRequest(t, owner, connection, "UNLOCK", "destination", nil, map[string]string{"Lock-Token": token}, 204)
	owner.request(t, "POST", lockedIDPath+"/retry", map[string]any{"revision": blocked["revision"]}, 200)
	waitDownloadState(t, owner, lockedIDPath, "completed")
	if len(owner.request(t, "GET", "/native/files?parent="+lockedID, nil, 200)["items"].([]any)) != 1 {
		t.Fatal("解除写锁后的重试重复发布目录")
	}

	// 节点暂时不可达时任务保留真实失败，恢复后只重试同一记录。
	outage := owner.request(t, "POST", "/native/files/torrent-downloads", map[string]string{"torrentBase64": base64.StdEncoding.EncodeToString(fixture.metadata), "nodeId": "local", "clientKey": "torrent-outage-fixture", "name": "node-recovered", "parentId": ""}, 200)
	outageID := outage["id"].(string)
	fixture.mu.Lock()
	fixture.unavailable = true
	fixture.mu.Unlock()
	owner.request(t, "PATCH", "/native/files/torrent-downloads/"+outageID+"/selection", map[string]any{"revision": outage["revision"], "indexes": []int{1}}, 200)
	outagePath := "/native/files/downloads/" + outageID
	failed := waitDownloadState(t, owner, outagePath, "failed")
	if failed["failureCode"] != "node" || failed["entryId"] != "" {
		t.Fatal("节点不可达没有显式失败或提前发布")
	}
	fixture.mu.Lock()
	fixture.unavailable = false
	fixture.mu.Unlock()
	owner.request(t, "POST", outagePath+"/retry", map[string]any{"revision": failed["revision"]}, 200)
	if waitDownloadState(t, owner, outagePath, "completed")["id"] != outageID {
		t.Fatal("节点恢复创建了另一条任务")
	}
}
