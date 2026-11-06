package webdav

import (
	"encoding/xml"
	"errors"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"strings"
	"testing"
)

func TestIfHeaderGrammarAndBudgets(t *testing.T) {
	resolve := func(tag string) (string, error) {
		if tag != "/dav/connection/a" {
			return "", model.ErrInvalid
		}
		return "/a", nil
	}
	for _, value := range []string{`(<urn:uuid:token> [W/"a]b"]) (Not <DAV:no-lock>)`, `</dav/connection/a> (<urn:uuid:token>)`} {
		if _, err := ParseIfHeader(value, "/a", resolve); err != nil {
			t.Fatalf("有效条件被拒绝: %q %v", value, err)
		}
	}
	for _, value := range []string{`()`, `(Not<urn:uuid:a>)`, `(<urn:uuid:a>) </dav/connection/a> (<urn:uuid:a>)`, `</dav/connection/a>`, `([abc])`, `(<bad>)`, `(<urn:a>) junk`, `(Not ["a"])\n`} {
		if _, err := ParseIfHeader(value, "/a", resolve); err == nil {
			t.Fatalf("非法条件被接受: %q", value)
		}
	}
	if _, err := ParseIfHeader("("+strings.Repeat("<urn:a> ", 65)+")", "/a", resolve); !errors.Is(err, model.ErrTooLarge) {
		t.Fatal("条件数量预算失效", err)
	}
}

func TestOwnerMixedXMLAndNamespacesSurviveStorage(t *testing.T) {
	body := []byte(`<D:lockinfo xmlns:D="DAV:" xmlns:x="urn:example"><D:lockscope xmlns:x="urn:wrong"><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype><D:owner>before<x:label x:kind="x:person">Editor &amp; client</x:label>after</D:owner></D:lockinfo>`)
	owner, err := parseLockInfo(body)
	if err != nil {
		t.Fatal(err)
	}
	var value xmlValue
	if err := decodeXML([]byte(owner), &value); err != nil {
		t.Fatal("持久owner无法重新解析", err, owner)
	}
	var text strings.Builder
	found := false
	for _, token := range value.Tokens {
		if chars, ok := token.(xml.CharData); ok {
			text.Write(chars)
		}
		if start, ok := token.(xml.StartElement); ok && start.Name == (xml.Name{Space: "urn:example", Local: "label"}) {
			found = true
		}
	}
	if !found || text.String() != "beforeEditor & clientafter" || !strings.Contains(owner, `xmlns:x="urn:example"`) {
		t.Fatal("owner的namespace或混合内容丢失", owner)
	}
	if _, err := parseLockInfo([]byte(`<!DOCTYPE x><lockinfo xmlns="DAV:"><lockscope><exclusive/></lockscope><locktype><write/></locktype></lockinfo>`)); err == nil {
		t.Fatal("DTD未被拒绝")
	}
}

func TestOwnerDefaultNamespaceAndQNameContextArePreserved(t *testing.T) {
	owner, err := parseLockInfo([]byte(`<lockinfo xmlns="DAV:" xmlns:x="urn:x"><lockscope><exclusive> </exclusive></lockscope><locktype><write/></locktype><owner><x:label xmlns="" kind="Person">value</x:label><plain xmlns="">plain</plain></owner></lockinfo>`))
	if err != nil {
		t.Fatal(err)
	}
	var value xmlValue
	if err := decodeXML([]byte(owner), &value); err != nil {
		t.Fatal(err)
	}
	plainFound, labelFound := false, false
	for _, token := range value.Tokens {
		if start, ok := token.(xml.StartElement); ok {
			if start.Name == (xml.Name{Local: "plain"}) {
				plainFound = true
			}
			if start.Name == (xml.Name{Space: "urn:x", Local: "label"}) {
				for _, attr := range start.Attr {
					if attr.Name == (xml.Name{Local: "xmlns"}) && attr.Value == "" {
						labelFound = true
					}
				}
			}
		}
	}
	if !plainFound || !labelFound {
		t.Fatal("默认namespace重置或QName语境丢失")
	}
}
