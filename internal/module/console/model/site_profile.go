package model

import (
	"net/url"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	SiteProfileNameRunes        = 80
	SiteProfileDescriptionRunes = 600
	SiteProfileURLBytes         = 1024
	MaxSiteProfileRevision      = 1<<53 - 1
)

// SiteProfile 是可直接提供给访客的站点展示配置。
type SiteProfile struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	LightLogo   string `json:"lightLogo"`
	DarkLogo    string `json:"darkLogo"`
	Icon        string `json:"icon"`
	TermsURL    string `json:"termsUrl"`
	PrivacyURL  string `json:"privacyUrl"`
}

// SiteProfileVersion 将公开内容和管理写入所需的修订号分开。
type SiteProfileVersion struct {
	Revision int64       `json:"revision"`
	Profile  SiteProfile `json:"profile"`
}

// Valid 校验可发布的纯文本、站内路径及 HTTPS 地址。
func (p SiteProfile) Valid() bool {
	if utf8.RuneCountInString(p.Name) > SiteProfileNameRunes ||
		utf8.RuneCountInString(p.Description) > SiteProfileDescriptionRunes ||
		strings.ContainsFunc(p.Name, unicode.IsControl) ||
		strings.ContainsFunc(p.Description, func(r rune) bool {
			return unicode.IsControl(r) && r != '\n' && r != '\t'
		}) {
		return false
	}
	for _, value := range []string{p.LightLogo, p.DarkLogo, p.Icon, p.TermsURL, p.PrivacyURL} {
		if !validSiteProfileURL(value) {
			return false
		}
	}
	return true
}

func validSiteProfileURL(value string) bool {
	if value == "" {
		return true
	}
	if len(value) > SiteProfileURLBytes || strings.Contains(value, "\\") ||
		strings.ContainsFunc(value, func(r rune) bool { return unicode.IsSpace(r) || unicode.IsControl(r) }) {
		return false
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.User != nil || parsed.Opaque != "" {
		return false
	}
	if strings.HasPrefix(value, "/") {
		return !strings.HasPrefix(value, "//") && parsed.Host == ""
	}
	return strings.HasPrefix(value, "https://") && parsed.Hostname() != ""
}
