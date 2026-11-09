package service

import (
	"net"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	maxWebFileApplications     = 8
	maxWebApplicationNameRunes = 64
	maxWebApplicationURLBytes  = 2048
	maxWebApplicationFileBytes = 1 << 40
)

var webApplicationID = regexp.MustCompile(`^web-[a-f0-9]{32}$`)
var webApplicationVariable = regexp.MustCompile(`\{\$[a-z_]+\}`)
var webApplicationHost = regexp.MustCompile(`^[a-z0-9.-]+$`)

// WebFileApplicationItem 是文件打开方式和授权提示所需的外部应用信息。
type WebFileApplicationItem struct {
	ID         FileApplicationID       `json:"id" pattern:"^web-[a-f0-9]{32}$"`
	Enabled    bool                    `json:"enabled"`
	Platform   FileApplicationPlatform `json:"platform" enum:"all,desktop,mobile"`
	Extensions []string                `json:"extensions" minItems:"1" maxItems:"128"`
	Name       string                  `json:"name" maxLength:"64"`
	Origin     string                  `json:"origin,omitempty" readOnly:"true"`
	IconURL    string                  `json:"iconUrl,omitempty" maxLength:"2048"`
	MaxBytes   int64                   `json:"maxBytes" minimum:"0" maximum:"1099511627776"`
	NewTab     bool                    `json:"newTab"`
	Protocol   FilePreviewProtocol     `json:"protocol,omitempty" enum:"wopi"`
}

// WebFileApplication 保存管理员配置的 URL 模板。
type WebFileApplication struct {
	WebFileApplicationItem
	URLTemplate string           `json:"urlTemplate" maxLength:"2048"`
	WOPI        *WOPIApplication `json:"wopi,omitempty"`
}

func normalizeWebFileApplications(values []WebFileApplication) ([]WebFileApplication, []WebFileApplicationItem, error) {
	if len(values) > maxWebFileApplications {
		return nil, nil, model.ErrInvalid
	}
	apps := make([]WebFileApplication, 0, len(values))
	items := make([]WebFileApplicationItem, 0, len(values))
	seen := make(map[FileApplicationID]bool, len(values))
	for _, app := range values {
		if seen[app.ID] || !webApplicationID.MatchString(string(app.ID)) {
			return nil, nil, model.ErrInvalid
		}
		seen[app.ID] = true
		app.Name = strings.TrimSpace(app.Name)
		app.URLTemplate = strings.TrimSpace(app.URLTemplate)
		app.IconURL = strings.TrimSpace(app.IconURL)
		if app.Name == "" || utf8.RuneCountInString(app.Name) > maxWebApplicationNameRunes ||
			strings.ContainsFunc(app.Name, unicode.IsControl) || app.MaxBytes < 0 || app.MaxBytes > maxWebApplicationFileBytes ||
			(app.IconURL != "" && !allowedIconURL(app.IconURL)) ||
			(app.Platform != FileAppAll && app.Platform != FileAppDesktop && app.Platform != FileAppMobile) {
			return nil, nil, model.ErrInvalid
		}
		limit := maxFileApplicationExtensions
		if app.Protocol == FilePreviewWOPI {
			limit = maxWOPIActions
		}
		extensions, err := normalizeApplicationExtensions(app.Extensions, limit)
		if err != nil || len(extensions) == 0 {
			return nil, nil, model.ErrInvalid
		}
		var origin string
		switch app.Protocol {
		case FilePreviewWOPI:
			if app.URLTemplate != "" {
				return nil, nil, model.ErrInvalid
			}
			origin, app.WOPI, err = normalizeWOPIApplication(app.WOPI, extensions)
		case "":
			if app.WOPI != nil {
				return nil, nil, model.ErrInvalid
			}
			origin, err = webApplicationOrigin(app.URLTemplate)
		default:
			return nil, nil, model.ErrInvalid
		}
		if err != nil {
			return nil, nil, err
		}
		app.Extensions, app.Origin = extensions, origin
		apps, items = append(apps, app), append(items, app.WebFileApplicationItem)
	}
	return apps, items, nil
}

func webApplicationOrigin(template string) (string, error) {
	target, origin, err := applicationHTTPSURL(template)
	if err != nil {
		return "", err
	}
	query, err := url.ParseQuery(target.RawQuery)
	if err != nil {
		return "", model.ErrInvalid
	}
	hasSource := false
	for key, values := range query {
		if key == "" || strings.ContainsAny(key, "{}") {
			return "", model.ErrInvalid
		}
		for _, value := range values {
			for _, variable := range webApplicationVariable.FindAllString(value, -1) {
				switch variable {
				case "{$src}", "{$src_raw}", "{$src_raw_base64}":
					hasSource = true
				case "{$name}", "{$theme}", "{$dark}":
				default:
					return "", model.ErrInvalid
				}
			}
			if strings.ContainsAny(webApplicationVariable.ReplaceAllString(value, ""), "{}") {
				return "", model.ErrInvalid
			}
		}
	}
	if !hasSource {
		return "", model.ErrInvalid
	}
	return origin, nil
}

func applicationHTTPSURL(template string) (*url.URL, string, error) {
	if len(template) > maxWebApplicationURLBytes || strings.ContainsFunc(template, func(r rune) bool {
		return unicode.IsControl(r) || unicode.IsSpace(r) || r == '\\'
	}) || strings.Contains(template, "#") {
		return nil, "", model.ErrInvalid
	}
	target, err := url.Parse(template)
	if err != nil || target.Scheme != "https" || target.Hostname() == "" || target.User != nil ||
		strings.ContainsAny(target.Host+target.Path, "{}") {
		return nil, "", model.ErrInvalid
	}
	host := strings.ToLower(target.Hostname())
	if ip := net.ParseIP(host); ip != nil && strings.Contains(host, ":") {
		host = "[" + ip.String() + "]"
	} else if !webApplicationHost.MatchString(host) {
		return nil, "", model.ErrInvalid
	}
	if port := target.Port(); port != "" {
		value, err := strconv.Atoi(port)
		if err != nil || value < 1 || value > 65535 {
			return nil, "", model.ErrInvalid
		}
		if value != 443 {
			host += ":" + strconv.Itoa(value)
		}
	}
	return target, (&url.URL{Scheme: target.Scheme, Host: host}).String(), nil
}
