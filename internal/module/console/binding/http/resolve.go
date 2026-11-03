package httpbinding

import (
	"bytes"
	"encoding/base64"
	"errors"
	"mime/multipart"
	"net/url"
	"regexp"
	"strings"
)

var interpolation = regexp.MustCompile(`\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}`)

func resolveDefinition(def RequestDefinition, variables map[string]string) (ResolvedRequest, error) {
	if def.PreScript != "" || def.PostScript != "" || len(def.Extractors) > 0 {
		return ResolvedRequest{}, errors.New("server-side scripts and extractors are not supported")
	}
	unresolved := false
	expand := func(value string) string {
		return interpolation.ReplaceAllStringFunc(value, func(match string) string {
			key := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(match, "{{"), "}}"))
			if value, ok := variables[key]; ok {
				return value
			}
			unresolved = true
			return match
		})
	}
	target, err := url.Parse(expand(def.URL))
	if err != nil {
		return ResolvedRequest{}, err
	}
	query := target.Query()
	for _, entry := range def.Params {
		if entry.Enabled {
			query.Add(expand(entry.Key), expand(entry.Value))
		}
	}
	headers := map[string]string{}
	for _, entry := range def.Headers {
		if entry.Enabled {
			headers[expand(entry.Key)] = expand(entry.Value)
		}
	}
	switch def.Auth.Type {
	case "bearer":
		headers["Authorization"] = "Bearer " + expand(def.Auth.Token)
	case "basic":
		headers["Authorization"] = "Basic " + base64.StdEncoding.EncodeToString([]byte(expand(def.Auth.Username)+":"+expand(def.Auth.Password)))
	case "api-key":
		if def.Auth.In == "query" {
			query.Set(expand(def.Auth.Key), expand(def.Auth.Value))
		} else {
			headers[expand(def.Auth.Key)] = expand(def.Auth.Value)
		}
	case "none", "":
	default:
		return ResolvedRequest{}, errors.New("unsupported authentication")
	}
	target.RawQuery = query.Encode()
	var body *string
	switch def.Body.Type {
	case "none", "":
	case "json", "text", "xml":
		value := expand(def.Body.Content)
		body = &value
		if headers["Content-Type"] == "" {
			switch def.Body.Type {
			case "json":
				headers["Content-Type"] = "application/json"
			case "xml":
				headers["Content-Type"] = "application/xml"
			default:
				headers["Content-Type"] = "text/plain"
			}
		}
	case "form-urlencoded":
		form := url.Values{}
		for _, entry := range def.Body.Entries {
			if entry.Enabled {
				form.Add(expand(entry.Key), expand(entry.Value))
			}
		}
		value := form.Encode()
		body = &value
		headers["Content-Type"] = "application/x-www-form-urlencoded"
	case "form-data":
		var buffer bytes.Buffer
		writer := multipart.NewWriter(&buffer)
		for _, entry := range def.Body.Entries {
			if entry.Enabled {
				if err := writer.WriteField(expand(entry.Key), expand(entry.Value)); err != nil {
					return ResolvedRequest{}, err
				}
			}
		}
		if err := writer.Close(); err != nil {
			return ResolvedRequest{}, err
		}
		value := buffer.String()
		body = &value
		headers["Content-Type"] = writer.FormDataContentType()
	default:
		return ResolvedRequest{}, errors.New("unsupported body type")
	}
	if unresolved {
		return ResolvedRequest{}, errors.New("unresolved variable")
	}
	return ResolvedRequest{Method: def.Method, URL: target.String(), Headers: headers, Body: body, TimeoutMS: 10000, Disguise: def.Disguise}, nil
}
