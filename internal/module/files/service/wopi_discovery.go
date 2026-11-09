package service

import (
	"bytes"
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	maxWOPIActions           = 128
	maxWOPIDiscoveryBytes    = 512 << 10
	maxWOPIStoredActionBytes = 24 << 10
	wopiDiscoveryTimeout     = 10 * time.Second
)

var wopiOptionalQuery = regexp.MustCompile(`<[A-Za-z0-9_]+=[A-Z0-9_]+&?>`)

// FilePreviewProtocol 标记需要专用回调的文件预览协议。
type FilePreviewProtocol string

const FilePreviewWOPI FilePreviewProtocol = "wopi"

// WOPIViewAction 将文件后缀绑定到已经解析的只读动作。
type WOPIViewAction struct {
	Extension string `json:"extension" maxLength:"24"`
	URL       string `json:"url" maxLength:"2048"`
	EditURL   string `json:"editUrl,omitempty" maxLength:"2048"`
}

// WOPIApplication 保存导入地址及本次发现的浏览动作。
type WOPIApplication struct {
	DiscoveryURL string           `json:"discoveryUrl" maxLength:"2048"`
	Actions      []WOPIViewAction `json:"actions" minItems:"1" maxItems:"128"`
	EditEnabled  bool             `json:"editEnabled,omitempty"`
}

// WOPIDiscoveryDraft 返回可审阅的发现结果，调用方决定是否保存。
type WOPIDiscoveryDraft struct {
	WOPIApplication
	Origin string `json:"origin"`
}

// WOPIDiscoverySource 通过已装配的安全出站适配器消费响应流。
type WOPIDiscoverySource interface {
	WithBody(context.Context, DownloadSourceRequest, func(DownloadSourceHeaders, io.Reader) error) error
}

// WOPIDiscovery 从受限 HTTPS 连接导入文档预览动作。
type WOPIDiscovery struct {
	source WOPIDiscoverySource
}

// NewWOPIDiscovery 装配发现与既有 HTTP 来源边界。
func NewWOPIDiscovery(source WOPIDiscoverySource) (*WOPIDiscovery, error) {
	if source == nil {
		return nil, fmt.Errorf("WOPI discovery source is required")
	}
	return &WOPIDiscovery{source: source}, nil
}

// Discover 只获取并验证公开发现描述，所有应用保存仍经过修订围栏。
func (s *WOPIDiscovery) Discover(ctx context.Context, address string) (WOPIDiscoveryDraft, error) {
	target, origin, err := applicationHTTPSURL(strings.TrimSpace(address))
	if err != nil {
		return WOPIDiscoveryDraft{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, wopiDiscoveryTimeout)
	defer cancel()
	var actions []WOPIViewAction
	err = s.source.WithBody(ctx, DownloadSourceRequest{URI: target.String(), MaxBytes: maxWOPIDiscoveryBytes},
		func(headers DownloadSourceHeaders, body io.Reader) error {
			_, receivedOrigin, err := applicationHTTPSURL(headers.EffectiveURI)
			if err != nil || receivedOrigin != origin {
				return model.ErrInvalid
			}
			encoded, err := io.ReadAll(io.LimitReader(body, maxWOPIDiscoveryBytes+1))
			if err != nil {
				return err
			}
			actions, err = parseWOPIDiscovery(encoded, origin)
			return err
		})
	if err != nil {
		if errors.Is(err, model.ErrInvalid) || errors.Is(err, model.ErrTooLarge) ||
			errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return WOPIDiscoveryDraft{}, err
		}
		return WOPIDiscoveryDraft{}, errors.Join(model.ErrDownloadUnavailable, err)
	}
	return WOPIDiscoveryDraft{WOPIApplication: WOPIApplication{DiscoveryURL: target.String(), Actions: actions}, Origin: origin}, nil
}

type wopiXMLAction struct {
	Name      string `xml:"name,attr"`
	Extension string `xml:"ext,attr"`
	URL       string `xml:"urlsrc,attr"`
	Requires  string `xml:"requires,attr"`
}

type wopiXMLDiscovery struct {
	XMLName xml.Name `xml:"wopi-discovery"`
	Zones   []struct {
		Name    string          `xml:"name,attr"`
		Actions []wopiXMLAction `xml:"app>action"`
	} `xml:"net-zone"`
}

func parseWOPIDiscovery(encoded []byte, origin string) ([]WOPIViewAction, error) {
	if len(encoded) > maxWOPIDiscoveryBytes {
		return nil, model.ErrTooLarge
	}
	if bytes.Contains(bytes.ToUpper(encoded), []byte("<!DOCTYPE")) {
		return nil, model.ErrInvalid
	}
	var discovery wopiXMLDiscovery
	decoder := xml.NewDecoder(bytes.NewReader(encoded))
	if err := decoder.Decode(&discovery); err != nil {
		return nil, errors.Join(model.ErrInvalid, err)
	}
	for {
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, errors.Join(model.ErrInvalid, err)
		}
		switch token := token.(type) {
		case xml.CharData:
			if len(bytes.TrimSpace(token)) != 0 {
				return nil, model.ErrInvalid
			}
		case xml.Comment:
		default:
			return nil, model.ErrInvalid
		}
	}
	seen := make(map[string]bool)
	editURLs := make(map[string]string)
	var actions []WOPIViewAction
	for _, zone := range discovery.Zones {
		if zone.Name != "external-https" && zone.Name != "external-http" {
			continue
		}
		for _, action := range zone.Actions {
			extension := normalizeFileApplicationExtension(action.Extension)
			if !fileApplicationExtension.MatchString(extension) ||
				(action.Name != "view" && action.Name != "edit") ||
				(action.Name == "view" && (action.Requires != "" || seen[extension])) ||
				(action.Name == "edit" && (!supportsWOPIEditRequirements(action.Requires) || editURLs[extension] != "")) {
				continue
			}
			address, err := wopiActionURL(wopiOptionalQuery.ReplaceAllString(action.URL, ""), origin)
			if err != nil {
				continue
			}
			if action.Name == "edit" {
				editURLs[extension] = address
				continue
			}
			seen[extension] = true
			actions = append(actions, WOPIViewAction{Extension: extension, URL: address})
		}
	}
	if len(actions) == 0 {
		return nil, model.ErrInvalid
	}
	for index := range actions {
		actions[index].EditURL = editURLs[actions[index].Extension]
	}
	if len(actions) > maxWOPIActions || wopiActionBytes(actions) > maxWOPIStoredActionBytes {
		return nil, model.ErrTooLarge
	}
	return actions, nil
}

func supportsWOPIEditRequirements(requirements string) bool {
	for _, requirement := range strings.Split(requirements, ",") {
		switch strings.TrimSpace(requirement) {
		case "", "locks", "update":
		default:
			return false
		}
	}
	return true
}

func wopiActionURL(address, origin string) (string, error) {
	target, actionOrigin, err := applicationHTTPSURL(address)
	if err != nil || actionOrigin != origin || strings.ContainsAny(address, "<>{}") {
		return "", model.ErrInvalid
	}
	query, err := url.ParseQuery(target.RawQuery)
	if err != nil {
		return "", model.ErrInvalid
	}
	for key := range query {
		switch strings.ToLower(key) {
		case "wopisrc", "access_token", "access_token_ttl":
			return "", model.ErrInvalid
		}
	}
	return target.String(), nil
}

func wopiActionBytes(actions []WOPIViewAction) int {
	size := 0
	for _, action := range actions {
		size += len(action.URL) + len(action.EditURL) + len(action.Extension)
	}
	return size
}

func normalizeWOPIApplication(input *WOPIApplication, extensions []string) (string, *WOPIApplication, error) {
	if input == nil || len(input.Actions) > maxWOPIActions || wopiActionBytes(input.Actions) > maxWOPIStoredActionBytes {
		return "", nil, model.ErrInvalid
	}
	discovery, origin, err := applicationHTTPSURL(strings.TrimSpace(input.DiscoveryURL))
	if err != nil {
		return "", nil, err
	}
	byExtension := make(map[string]string, len(input.Actions))
	actions := make([]WOPIViewAction, 0, len(input.Actions))
	for _, action := range input.Actions {
		extension := normalizeFileApplicationExtension(action.Extension)
		if !fileApplicationExtension.MatchString(extension) || byExtension[extension] != "" {
			return "", nil, model.ErrInvalid
		}
		address, err := wopiActionURL(action.URL, origin)
		if err != nil {
			return "", nil, err
		}
		byExtension[extension] = address
		var editURL string
		if action.EditURL != "" {
			editURL, err = wopiActionURL(action.EditURL, origin)
			if err != nil {
				return "", nil, err
			}
		}
		actions = append(actions, WOPIViewAction{Extension: extension, URL: address, EditURL: editURL})
	}
	for _, extension := range extensions {
		if byExtension[extension] == "" {
			return "", nil, model.ErrInvalid
		}
	}
	return origin, &WOPIApplication{DiscoveryURL: discovery.String(), Actions: actions, EditEnabled: input.EditEnabled}, nil
}
