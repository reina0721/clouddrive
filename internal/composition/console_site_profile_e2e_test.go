package composition

import (
	"net/http"
	"strings"
	"testing"

	"github.com/reina0721/clouddrive/internal/module/console/model"
)

const (
	siteProfileAdmin    = "/system/site-profile"
	siteProfilePublic   = "/site-profile"
	testSiteProfileName = "文件工作区测试站"
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
