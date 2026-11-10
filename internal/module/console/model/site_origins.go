package model

import (
	"net/netip"
	"net/url"
	"strconv"
	"strings"
)

const (
	MaxSiteAlternatives   = 8
	MaxPublicationOrigins = 32
)

// SiteAddresses 记录主站和按显示顺序排列的备选站点。
type SiteAddresses struct {
	Primary      string   `json:"primary"`
	Alternatives []string `json:"alternatives"`
}

// CanonicalSiteOrigin 仅接受可在浏览器 Origin 中精确匹配的根站点地址。
func CanonicalSiteOrigin(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if len(value) > SiteProfileURLBytes || strings.ContainsAny(value, "\\?#") {
		return "", false
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.User != nil || parsed.RawPath != "" ||
		(parsed.Path != "" && parsed.Path != "/") {
		return "", false
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "https" && scheme != "http" {
		return "", false
	}
	host := strings.ToLower(parsed.Hostname())
	address, ipErr := netip.ParseAddr(host)
	loopback := host == "localhost"
	if ipErr == nil {
		if address.Zone() != "" || address.Is4In6() {
			return "", false
		}
		loopback = address.IsLoopback()
		host = address.String()
		if address.Is6() {
			host = "[" + host + "]"
		}
	} else if strings.ContainsAny(parsed.Host, "[]") || !validSiteDNSHost(host) {
		return "", false
	}
	if scheme == "http" && !loopback {
		return "", false
	}
	if rawPort := parsed.Port(); rawPort != "" {
		port, err := strconv.Atoi(rawPort)
		if err != nil || port < 1 || port > 65535 {
			return "", false
		}
		if (scheme != "https" || port != 443) && (scheme != "http" || port != 80) {
			host += ":" + strconv.Itoa(port)
		}
	}
	return scheme + "://" + host, true
}

func validSiteDNSHost(host string) bool {
	if len(host) > 253 {
		return false
	}
	labels := strings.Split(host, ".")
	last := labels[len(labels)-1]
	// 拒绝浏览器可能当作数字 IPv4 解析的非常规写法。
	if strings.HasPrefix(last, "0x") || !strings.ContainsAny(last, "abcdefghijklmnopqrstuvwxyz") {
		return false
	}
	for _, label := range labels {
		if label == "" || len(label) > 63 || strings.HasPrefix(label, "-") || strings.HasSuffix(label, "-") {
			return false
		}
		for _, char := range label {
			if (char < 'a' || char > 'z') && (char < '0' || char > '9') && char != '-' {
				return false
			}
		}
	}
	return true
}

// NormalizeSiteAddresses 规范化保存值。空主站和空列表表示沿用当前站点。
func NormalizeSiteAddresses(value *SiteAddresses) (*SiteAddresses, bool) {
	if value == nil || (strings.TrimSpace(value.Primary) == "" && len(value.Alternatives) == 0) {
		return nil, true
	}
	primary, ok := CanonicalSiteOrigin(value.Primary)
	if !ok || len(value.Alternatives) > MaxSiteAlternatives {
		return nil, false
	}
	addresses := &SiteAddresses{Primary: primary, Alternatives: make([]string, 0, len(value.Alternatives))}
	seen := map[string]bool{primary: true}
	for _, candidate := range value.Alternatives {
		alternative, ok := CanonicalSiteOrigin(candidate)
		if !ok || seen[alternative] {
			return nil, false
		}
		seen[alternative] = true
		addresses.Alternatives = append(addresses.Alternatives, alternative)
	}
	return addresses, true
}
