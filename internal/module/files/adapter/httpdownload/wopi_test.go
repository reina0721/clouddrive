package httpdownload

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/logger"
)

func TestWOPIDiscoveryUsesBoundedVerifiedHTTPS(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := "https://" + r.Host
		var body string
		switch r.URL.Path {
		case "/hosting/discovery":
			if r.Method != http.MethodGet || r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" {
				t.Error("发现请求携带了不应发送的身份信息")
			}
			w.Header().Set("Content-Type", "application/xml")
			body = `<wopi-discovery><net-zone name="external-http"><app name="writer">
				<action name="edit" ext="docm" urlsrc="` + origin + `/edit"/>
				<action name="view" ext="DOCX" urlsrc="` + origin + `/document?lang=&lt;ui=UI_LLCC&amp;&gt;"/>
				<action name="edit" ext="DOCX" requires="locks,update" urlsrc="` + origin + `/edit-document"/>
				<action name="edit" ext="xlsx" requires="cobalt" urlsrc="` + origin + `/edit-sheet"/>
				<action name="view" ext="docx" urlsrc="` + origin + `/duplicate"/>
				<action name="view" ext="xlsx" urlsrc="` + origin + `/spreadsheet?"/>
				<action name="view" ext="pptx" urlsrc="https://elsewhere.example.test/view"/>
				<action name="view" ext="doc" requires="locks" urlsrc="` + origin + `/locked"/>
				<action name="view" ext="odt" urlsrc="` + origin + `/reject?WOPISrc=https://elsewhere.example.test"/>
				</app></net-zone><net-zone name="internal-https"><app name="private">
				<action name="view" ext="odg" urlsrc="` + origin + `/private"/>
				</app></net-zone></wopi-discovery>`
		case "/malformed":
			body = "<wopi-discovery><invalid>"
		case "/oversized":
			body = strings.Repeat(" ", 513<<10)
		default:
			http.NotFound(w, r)
			return
		}
		if _, err := io.WriteString(w, body); err != nil {
			t.Error(err)
		}
	}))
	t.Cleanup(server.Close)
	policy := service.DefaultDownloadPolicy().Source
	policy.AllowedNetworks = []string{"127.0.0.1/32"}
	client, err := New(policy, time.Minute, logger.NewTestLogger())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := client.Stop(context.Background()); err != nil {
			t.Error(err)
		}
	})
	client.transport.TLSClientConfig.RootCAs = server.Client().Transport.(*http.Transport).TLSClientConfig.RootCAs
	discovery, err := service.NewWOPIDiscovery(client)
	if err != nil {
		t.Fatal(err)
	}
	draft, err := discovery.Discover(t.Context(), server.URL+"/hosting/discovery")
	if err != nil {
		t.Fatal(err)
	}
	if draft.Origin != server.URL || len(draft.Actions) != 2 ||
		draft.Actions[0].Extension != "docx" || strings.Contains(draft.Actions[0].URL, "UI_LLCC") ||
		draft.Actions[0].EditURL != server.URL+"/edit-document" || draft.Actions[1].EditURL != "" ||
		draft.Actions[1].Extension != "xlsx" || !strings.Contains(draft.Actions[1].URL, "/spreadsheet") {
		t.Fatalf("发现结果未过滤或解析动作: %+v", draft)
	}
	for _, example := range []struct {
		address string
		err     error
	}{
		{server.URL + "/malformed", model.ErrInvalid},
		{server.URL + "/oversized", model.ErrTooLarge},
		{strings.Replace(server.URL, "https:", "http:", 1), model.ErrInvalid},
	} {
		if _, err := discovery.Discover(t.Context(), example.address); !errors.Is(err, example.err) {
			t.Fatalf("发现错误 = %v，预期 %v", err, example.err)
		}
	}
}
