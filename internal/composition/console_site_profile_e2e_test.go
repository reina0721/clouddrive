package composition

import (
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/reina0721/clouddrive/internal/module/console/model"
)

const (
	siteProfileAdmin    = "/system/site-profile"
	siteProfilePublic   = "/site-profile"
	testSiteProfileName = "文件工作区测试站"
	testSitePrimary     = "https://files.example.test"
	testSiteAlternative = "https://edge.example.test"
)

func verifyConsoleSiteProfile(t *testing.T, owner, member *consoleTestClient) {
	t.Helper()
	guest := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	initial := guest.request(t, http.MethodGet, siteProfilePublic, nil, 200)
	if len(initial) != 7 || initial["name"] != "" {
		t.Fatal("缺省公开站点信息不完整")
	}
	guest.request(t, http.MethodGet, siteProfileAdmin, nil, 401)
	member.request(t, http.MethodGet, siteProfileAdmin, nil, 403)
	current := owner.request(t, http.MethodGet, siteProfileAdmin, nil, 200)
	draft := model.SiteProfileVersion{Revision: int64(current["revision"].(float64)), Profile: model.SiteProfile{
		Name: testSiteProfileName, Description: "这是公开说明\n第二行",
		LightLogo: "/logo.svg", DarkLogo: "https://example.test/dark.png", Icon: "/icon.png",
		TermsURL: "/terms", PrivacyURL: "https://example.test/privacy",
	}}
	member.request(t, http.MethodPut, siteProfileAdmin, draft, 403)
	owner.request(t, http.MethodPut, siteProfileAdmin, draft, 403, map[string]string{"Origin": "https://untrusted.example"})
	owner.request(t, http.MethodPut, siteProfileAdmin, draft, 403, map[string]string{"X-CSRF-Token": "incorrect"})
	owner.request(t, http.MethodPut, siteProfileAdmin, map[string]any{"revision": draft.Revision}, 422)
	for _, invalid := range []string{"javascript:alert(1)", "//example.test/logo", "https://u:p@example.test/logo", "/\\example.test/logo", "https://example.test/\nlogo", "https:///example.test/logo"} {
		bad := draft
		bad.Profile.LightLogo = invalid
		owner.request(t, http.MethodPut, siteProfileAdmin, bad, 422)
	}
	bad := draft
	bad.Profile.Name = strings.Repeat("站", model.SiteProfileNameRunes+1)
	owner.request(t, http.MethodPut, siteProfileAdmin, bad, 422)
	saved := owner.request(t, http.MethodPut, siteProfileAdmin, draft, 200)
	if saved["revision"] != float64(draft.Revision+1) {
		t.Fatal("保存后未返回新修订")
	}
	owner.request(t, http.MethodPut, siteProfileAdmin, draft, 409)
	visible := guest.request(t, http.MethodGet, siteProfilePublic, nil, 200)
	if len(visible) != 7 || visible["revision"] != nil || visible["name"] != draft.Profile.Name ||
		visible["description"] != draft.Profile.Description || visible["darkLogo"] != draft.Profile.DarkLogo ||
		visible["privacyUrl"] != draft.Profile.PrivacyURL {
		t.Fatal("公开响应未准确发布站点信息")
	}
}

func verifySiteOrigins(t *testing.T, owner, member *consoleTestClient) {
	t.Helper()
	guest := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	current := owner.request(t, http.MethodGet, siteProfileAdmin, nil, 200)
	allowed := current["publicationOrigins"].([]any)
	if len(allowed) != 2 || allowed[0] != testSitePrimary || allowed[1] != testSiteAlternative {
		t.Fatal("站点设置未显示规范化的部署许可")
	}
	draft := map[string]any{"revision": current["revision"], "profile": current["profile"]}
	profile := draft["profile"].(map[string]any)
	write := func(primary string, alternatives []string, status int) map[string]any {
		t.Helper()
		profile["siteAddresses"] = model.SiteAddresses{Primary: primary, Alternatives: alternatives}
		return owner.request(t, http.MethodPut, siteProfileAdmin, draft, status)
	}
	for _, value := range []string{"http://files.example.test", "https://files.example.test/sub", "https://files.example.test?x=1", "https://user@files.example.test", "https://[abc]", "https://0x7f000001", "https://files.example.test:70000"} {
		write(value, nil, 422)
	}
	write(testSitePrimary, []string{testSitePrimary + "/"}, 422)
	write("", []string{testSiteAlternative}, 422)
	write(testSitePrimary, slices.Repeat([]string{testSiteAlternative}, model.MaxSiteAlternatives+1), 422)
	denied := write("https://unapproved.example.test", nil, 422)
	if denied["error"].(map[string]any)["reason"] != "site-origin-not-allowed" {
		t.Fatal("未区分无部署许可的地址")
	}
	member.request(t, http.MethodPut, siteProfileAdmin, draft, 403)
	saved := write("https://FILES.example.test:443/", []string{testSiteAlternative + "/"}, 200)
	write(testSitePrimary, nil, 409)
	public := guest.request(t, http.MethodGet, siteProfilePublic, nil, 200)
	addresses := public["siteAddresses"].(map[string]any)
	if addresses["primary"] != testSitePrimary || len(addresses["alternatives"].([]any)) != 1 ||
		addresses["alternatives"].([]any)[0] != testSiteAlternative || public["publicationOrigins"] != nil {
		t.Fatal("访客发布策略不正确")
	}
	draft["revision"] = saved["revision"]
	cleared := write("", []string{}, 200)
	if guest.request(t, http.MethodGet, siteProfilePublic, nil, 200)["siteAddresses"] != nil {
		t.Fatal("清空后仍发布站点地址")
	}
	draft["revision"] = cleared["revision"]
	write(testSitePrimary, []string{testSiteAlternative}, 200)
}

func verifySiteOriginsAfterRestart(t *testing.T, owner *consoleTestClient) {
	t.Helper()
	public := owner.request(t, http.MethodGet, siteProfilePublic, nil, 200)
	addresses := public["siteAddresses"].(map[string]any)
	if public["name"] != testSiteProfileName || addresses["primary"] != testSitePrimary ||
		len(addresses["alternatives"].([]any)) != 0 {
		t.Fatal("重启后未保留主站或仍发布撤销许可的备选站点")
	}
	settings := owner.request(t, http.MethodGet, siteProfileAdmin, nil, 200)
	draft := settings["profile"].(map[string]any)["siteAddresses"].(map[string]any)
	if len(draft["alternatives"].([]any)) != 1 {
		t.Fatal("部署许可变更重写了管理员的保存值")
	}
}
