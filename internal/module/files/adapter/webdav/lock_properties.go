package webdav

import (
	"bytes"
	"context"
	"encoding/xml"
	"net/url"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type propFindXML struct {
	XMLName xml.Name          `xml:"DAV: propfind"`
	All     *emptyXML         `xml:"DAV: allprop"`
	Names   *emptyXML         `xml:"DAV: propname"`
	Prop    *davPropertiesXML `xml:"DAV: prop"`
	Include *davPropertiesXML `xml:"DAV: include"`
}

func propertyName(value xmlValue) xml.Name {
	if len(value.Tokens) == 0 {
		return xml.Name{}
	}
	start, ok := value.Tokens[0].(xml.StartElement)
	if !ok {
		return xml.Name{}
	}
	return start.Name
}
func emptyProperty(local string) xmlValue {
	start := xml.StartElement{Name: xml.Name{Space: davNamespace, Local: local}}
	return xmlValue{Tokens: []xml.Token{start, start.End()}}
}

// augmentLockProperties 只替换两个新增的活属性，普通属性的namespace和值继续来自成熟协议库。
func (p *Protocol) augmentLockProperties(ctx context.Context, scope service.DAVScope, prefix string, requestBody []byte, response *controlResponse) error {
	query := propFindXML{All: &emptyXML{}}
	if len(requestBody) != 0 {
		query = propFindXML{}
		if err := decodeXML(requestBody, &query); err != nil {
			return model.ErrInvalid
		}
	}
	wanted := map[string]bool{}
	if query.All != nil || query.Names != nil {
		wanted["supportedlock"], wanted["lockdiscovery"] = true, true
	}
	for _, props := range []*davPropertiesXML{query.Prop, query.Include} {
		if props != nil {
			for _, value := range props.Values {
				name := propertyName(value)
				if name.Space == davNamespace && (name.Local == "supportedlock" || name.Local == "lockdiscovery") {
					wanted[name.Local] = true
				}
			}
		}
	}
	if len(wanted) == 0 {
		return nil
	}
	var multi davMultiStatusXML
	if err := decodeXML(response.body.Bytes(), &multi); err != nil {
		return err
	}
	paths := make([]string, len(multi.Responses))
	for index, item := range multi.Responses {
		uri, err := url.Parse(item.Href)
		if err != nil || uri.Host != "" || uri.RawQuery != "" || !strings.HasPrefix(uri.Path, prefix+"/") {
			return model.ErrInvalid
		}
		paths[index] = strings.TrimPrefix(uri.Path, prefix)
	}
	discoveries, err := p.files.WriteLocks().Discover(ctx, scope, paths)
	if err != nil {
		return err
	}
	for index := range multi.Responses {
		item := &multi.Responses[index]
		filtered := make([]davPropStatXML, 0, len(item.Props)+2)
		for _, stat := range item.Props {
			kept := []xmlValue{}
			for _, value := range stat.Prop.Values {
				name := propertyName(value)
				if name.Space == davNamespace && wanted[name.Local] {
					continue
				}
				kept = append(kept, value)
			}
			if len(kept) > 0 {
				stat.Prop.Values = kept
				filtered = append(filtered, stat)
			}
		}
		good := []xmlValue{}
		if wanted["supportedlock"] {
			value := emptyProperty("supportedlock")
			if query.Names == nil {
				entries := []lockEntryXML{}
				if discoveries[index].SupportsLock {
					entries = append(entries, lockEntryXML{})
				}
				value, err = xmlProperty(supportedLockXML{Entries: entries})
				if err != nil {
					return err
				}
			}
			good = append(good, value)
		}
		if wanted["lockdiscovery"] {
			value := emptyProperty("lockdiscovery")
			if discoveries[index].HiddenRoot {
				filtered = append(filtered, davPropStatXML{Prop: davPropertiesXML{Values: []xmlValue{value}}, Status: "HTTP/1.1 403 Forbidden"})
			} else {
				if query.Names == nil {
					property := lockDiscoveryXML{Active: []activeLockXML{}}
					for _, discovered := range discoveries[index].Locks {
						active, err := activeLock(discovered.Lock, discovered.RelativeRoot, prefix, p.files.WriteLocks().Remaining(discovered.Lock))
						if err != nil {
							return err
						}
						property.Active = append(property.Active, active)
					}
					value, err = xmlProperty(property)
					if err != nil {
						return err
					}
				}
				good = append(good, value)
			}
		}
		if len(good) > 0 {
			filtered = append(filtered, davPropStatXML{Prop: davPropertiesXML{Values: good}, Status: "HTTP/1.1 200 OK"})
		}
		item.Props = filtered
	}
	encoded, err := xml.Marshal(multi)
	if err != nil {
		return err
	}
	if int64(len(encoded)) > p.policy.ResponseBytes {
		return ErrResponseBudget
	}
	response.body = *bytes.NewBuffer(encoded)
	response.header.Set("Content-Type", "application/xml; charset=utf-8")
	response.header.Del("Content-Length")
	return nil
}
