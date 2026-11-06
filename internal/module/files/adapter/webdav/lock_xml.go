package webdav

import (
	"bytes"
	"encoding/xml"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

const davNamespace = "DAV:"
const maxControlXMLDepth = 64
const maxControlXMLTokens = 32768
const maxOwnerXMLDepth = 32
const maxOwnerXMLTokens = 512

// xmlValue 保留namespace解析后的有界混合内容；只用于协议局部的XML往返。
type xmlValue struct{ Tokens []xml.Token }

func (v *xmlValue) UnmarshalXML(decoder *xml.Decoder, start xml.StartElement) error {
	v.Tokens = []xml.Token{xml.CopyToken(start)}
	depth := 1
	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			return err
		}
		if _, ok := token.(xml.Directive); ok {
			return model.ErrInvalid
		}
		if _, ok := token.(xml.ProcInst); ok {
			return model.ErrInvalid
		}
		switch token.(type) {
		case xml.StartElement:
			depth++
		case xml.EndElement:
			depth--
		}
		if depth > maxControlXMLDepth || len(v.Tokens) >= maxControlXMLTokens {
			return model.ErrTooLarge
		}
		v.Tokens = append(v.Tokens, xml.CopyToken(token))
	}
	return nil
}

func (v xmlValue) MarshalXML(encoder *xml.Encoder, _ xml.StartElement) error {
	// 显式前缀避免encoding/xml改变默认namespace，从而改变QName属性值或混合内容语义。
	occupied := map[string]bool{"xml": true, "xmlns": true}
	for _, token := range v.Tokens {
		if start, ok := token.(xml.StartElement); ok {
			for _, attr := range start.Attr {
				if attr.Name.Space == "xmlns" {
					occupied[attr.Name.Local] = true
				}
			}
		}
	}
	prefixes := map[string]string{}
	qualify := func(name xml.Name, declarations *[]xml.Attr) xml.Name {
		if name.Space == "" {
			return name
		}
		if name.Space == "http://www.w3.org/XML/1998/namespace" {
			return xml.Name{Local: "xml:" + name.Local}
		}
		prefix, ok := prefixes[name.Space]
		if !ok {
			for index := 0; ; index++ {
				candidate := "ns" + strconv.Itoa(index)
				if !occupied[candidate] {
					prefix = candidate
					occupied[candidate] = true
					prefixes[name.Space] = prefix
					break
				}
			}
		}
		if declarations != nil {
			*declarations = append(*declarations, xml.Attr{Name: xml.Name{Local: "xmlns:" + prefix}, Value: name.Space})
		}
		return xml.Name{Local: prefix + ":" + name.Local}
	}
	for _, token := range v.Tokens {
		if start, ok := token.(xml.StartElement); ok {
			attrs := make([]xml.Attr, 0, len(start.Attr))
			defaultDeclared := false
			declarations := []xml.Attr{}
			originalNamespace := start.Name.Space
			start.Name = qualify(start.Name, &declarations)
			for _, attr := range start.Attr {
				if attr.Name.Space == "" && attr.Name.Local == "xmlns" {
					defaultDeclared = true
				}
				if attr.Name.Space == "xmlns" {
					attr.Name = xml.Name{Local: "xmlns:" + attr.Name.Local}
				} else {
					attr.Name = qualify(attr.Name, &declarations)
				}
				attrs = append(attrs, attr)
			}
			if originalNamespace == "" && !defaultDeclared {
				attrs = append(attrs, xml.Attr{Name: xml.Name{Local: "xmlns"}, Value: ""})
			}
			// 同一元素的名字和属性可能使用同一namespace，声明只能输出一次。
			seen := map[string]bool{}
			for _, declaration := range declarations {
				if !seen[declaration.Name.Local] {
					attrs = append(attrs, declaration)
					seen[declaration.Name.Local] = true
				}
			}
			start.Attr = attrs
			token = start
		} else if end, ok := token.(xml.EndElement); ok {
			end.Name = qualify(end.Name, nil)
			token = end
		}
		if err := encoder.EncodeToken(token); err != nil {
			return err
		}
	}
	return nil
}

func decodeXML(body []byte, target any) error {
	// 预扫描覆盖被encoding/xml自动跳过的未知元素与DTD，预算不依赖目标结构。
	decoder := xml.NewDecoder(bytes.NewReader(body))
	depth, count, roots := 0, 0, 0
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		count++
		if count > maxControlXMLTokens {
			return model.ErrTooLarge
		}
		switch value := token.(type) {
		case xml.StartElement:
			if depth == 0 {
				roots++
			}
			depth++
			if depth > maxControlXMLDepth {
				return model.ErrTooLarge
			}
		case xml.EndElement:
			depth--
		case xml.Directive:
			return model.ErrInvalid
		case xml.ProcInst:
			if value.Target != "xml" || roots > 0 {
				return model.ErrInvalid
			}
		case xml.CharData:
			if depth == 0 && strings.TrimSpace(string(value)) != "" {
				return model.ErrInvalid
			}
		}
	}
	if depth != 0 || roots != 1 {
		return model.ErrInvalid
	}
	return xml.Unmarshal(body, target)
}

type lockInfoXML struct {
	XMLName xml.Name `xml:"DAV: lockinfo"`
	Scope   struct {
		Values []xmlValue `xml:",any"`
	} `xml:"DAV: lockscope"`
	Type struct {
		Values []xmlValue `xml:",any"`
	} `xml:"DAV: locktype"`
	Owner *xmlValue `xml:"DAV: owner"`
}

func parseLockInfo(body []byte) (string, error) {
	var value lockInfoXML
	if err := decodeXML(body, &value); err != nil {
		return "", model.ErrInvalid
	}
	inherited, err := lockOwnerNamespaces(body)
	if err != nil {
		return "", err
	}
	validKind := func(values []xmlValue, name string) bool {
		if len(values) != 1 || len(values[0].Tokens) < 2 {
			return false
		}
		start, ok := values[0].Tokens[0].(xml.StartElement)
		if !ok || start.Name != (xml.Name{Space: davNamespace, Local: name}) {
			return false
		}
		for _, token := range values[0].Tokens[1 : len(values[0].Tokens)-1] {
			switch value := token.(type) {
			case xml.CharData:
				if strings.TrimSpace(string(value)) != "" {
					return false
				}
			case xml.Comment:
			default:
				return false
			}
		}
		return true
	}
	if !validKind(value.Scope.Values, "exclusive") || !validKind(value.Type.Values, "write") {
		return "", model.ErrUnsupported
	}
	if value.Owner == nil {
		return "", nil
	}
	if len(value.Owner.Tokens) > maxOwnerXMLTokens {
		return "", model.ErrTooLarge
	}
	depth := 0
	for _, token := range value.Owner.Tokens {
		switch token.(type) {
		case xml.StartElement:
			depth++
			if depth > maxOwnerXMLDepth {
				return "", model.ErrTooLarge
			}
		case xml.EndElement:
			depth--
		}
	}
	// 保留祖先声明的命名前缀，确保owner中的QName文本/属性值在独立序列化后仍有绑定。
	start := value.Owner.Tokens[0].(xml.StartElement)
	prefixes := make([]string, 0, len(inherited))
	for prefix := range inherited {
		prefixes = append(prefixes, prefix)
	}
	sort.Strings(prefixes)
	for _, prefix := range prefixes {
		namespace := inherited[prefix]
		found := false
		for _, attr := range start.Attr {
			if attr.Name.Space == "xmlns" && attr.Name.Local == prefix || prefix == "" && attr.Name.Space == "" && attr.Name.Local == "xmlns" {
				found = true
				break
			}
		}
		if !found {
			name := xml.Name{Space: "xmlns", Local: prefix}
			if prefix == "" {
				name = xml.Name{Local: "xmlns"}
			}
			start.Attr = append(start.Attr, xml.Attr{Name: name, Value: namespace})
		}
	}
	value.Owner.Tokens[0] = start
	encoded, err := xml.Marshal(value.Owner)
	if err != nil {
		return "", err
	}
	if len(encoded) > model.MaxWriteLockOwnerXMLBytes {
		return "", model.ErrTooLarge
	}
	return string(encoded), nil
}

// lockOwnerNamespaces 按XML词法作用域保留前缀，兄弟节点的声明不得污染owner。
func lockOwnerNamespaces(body []byte) (map[string]string, error) {
	decoder := xml.NewDecoder(bytes.NewReader(body))
	stack := []map[string]string{}
	counts := map[string]int{}
	owner := map[string]string{}
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		switch value := token.(type) {
		case xml.StartElement:
			current := map[string]string{"": ""}
			if len(stack) > 0 {
				for prefix, namespace := range stack[len(stack)-1] {
					current[prefix] = namespace
				}
			}
			for _, attr := range value.Attr {
				if attr.Name.Space == "xmlns" {
					current[attr.Name.Local] = attr.Value
				} else if attr.Name.Space == "" && attr.Name.Local == "xmlns" {
					current[""] = attr.Value
				}
			}
			stack = append(stack, current)
			if len(stack) == 2 && value.Name.Space == davNamespace {
				counts[value.Name.Local]++
				if value.Name.Local == "owner" {
					owner = current
				}
			}
		case xml.EndElement:
			if len(stack) == 0 {
				return nil, model.ErrInvalid
			}
			stack = stack[:len(stack)-1]
		}
	}
	if counts["lockscope"] != 1 || counts["locktype"] != 1 || counts["owner"] > 1 {
		return nil, model.ErrInvalid
	}
	return owner, nil
}

type emptyXML struct{}
type lockScopeXML struct {
	Exclusive emptyXML `xml:"DAV: exclusive"`
}
type lockTypeXML struct {
	Write emptyXML `xml:"DAV: write"`
}
type hrefXML struct {
	Href string `xml:"DAV: href"`
}
type activeLockXML struct {
	Scope   lockScopeXML `xml:"DAV: lockscope"`
	Type    lockTypeXML  `xml:"DAV: locktype"`
	Depth   string       `xml:"DAV: depth"`
	Owner   *xmlValue    `xml:",any"`
	Timeout string       `xml:"DAV: timeout"`
	Token   hrefXML      `xml:"DAV: locktoken"`
	Root    hrefXML      `xml:"DAV: lockroot"`
}
type lockDiscoveryXML struct {
	XMLName xml.Name        `xml:"DAV: lockdiscovery"`
	Active  []activeLockXML `xml:"DAV: activelock"`
}
type lockResponseXML struct {
	XMLName   xml.Name         `xml:"DAV: prop"`
	Discovery lockDiscoveryXML `xml:"DAV: lockdiscovery"`
}
type supportedLockXML struct {
	XMLName xml.Name       `xml:"DAV: supportedlock"`
	Entries []lockEntryXML `xml:"DAV: lockentry"`
}
type lockEntryXML struct {
	Scope lockScopeXML `xml:"DAV: lockscope"`
	Type  lockTypeXML  `xml:"DAV: locktype"`
}

func activeLock(lock model.WriteLock, relative, prefix string, remaining time.Duration) (activeLockXML, error) {
	value := activeLockXML{Depth: string(lock.Depth), Timeout: "Second-" + strconv.FormatInt(max(int64(1), int64(remaining/time.Second)), 10), Token: hrefXML{Href: lock.Token()}, Root: hrefXML{Href: (&url.URL{Path: prefix + relative}).EscapedPath()}}
	if lock.OwnerXML != "" {
		owner := &xmlValue{}
		if err := decodeXML([]byte(lock.OwnerXML), owner); err != nil {
			return activeLockXML{}, err
		}
		value.Owner = owner
	}
	return value, nil
}

func writeControlXML(writer http.ResponseWriter, status int, value any, limit int64) error {
	encoded, err := xml.Marshal(value)
	if err != nil {
		return err
	}
	if int64(len(encoded)) > limit {
		return ErrResponseBudget
	}
	writer.Header().Set("Content-Type", "application/xml; charset=utf-8")
	writer.WriteHeader(status)
	_, err = writer.Write(encoded)
	return err
}

type davPropStatXML struct {
	Prop   davPropertiesXML `xml:"DAV: prop"`
	Status string           `xml:"DAV: status"`
}
type davPropertiesXML struct {
	Values []xmlValue `xml:",any"`
}
type davResponseXML struct {
	Href   string           `xml:"DAV: href"`
	Props  []davPropStatXML `xml:"DAV: propstat"`
	Status string           `xml:"DAV: status,omitempty"`
}
type davMultiStatusXML struct {
	XMLName   xml.Name         `xml:"DAV: multistatus"`
	Responses []davResponseXML `xml:"DAV: response"`
}

func xmlProperty(value any) (xmlValue, error) {
	encoded, err := xml.Marshal(value)
	if err != nil {
		return xmlValue{}, err
	}
	var result xmlValue
	if err := decodeXML(encoded, &result); err != nil {
		return xmlValue{}, err
	}
	return result, nil
}

func conflictXML(requestPath, prefix string, conflict *service.DAVLockConflict) davMultiStatusXML {
	result := davMultiStatusXML{Responses: []davResponseXML{{Href: (&url.URL{Path: prefix + requestPath}).EscapedPath(), Status: "HTTP/1.1 424 Failed Dependency"}}}
	for _, path := range conflict.Descendants {
		result.Responses = append(result.Responses, davResponseXML{Href: (&url.URL{Path: prefix + path}).EscapedPath(), Status: "HTTP/1.1 423 Locked"})
	}
	return result
}
