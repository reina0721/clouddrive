package webdav

import (
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"net/url"
	"strings"
)

// ParseIfHeader 解析RFC4918的有界条件语法；资源标签交由binding验证同源、连接和URI边界。
func ParseIfHeader(header, requestPath string, resource func(string) (string, error)) (model.DAVCondition, error) {
	if header == "" {
		return model.DAVCondition{}, nil
	}
	if len(header) > model.MaxDAVConditionBytes {
		return model.DAVCondition{}, model.ErrTooLarge
	}
	if strings.ContainsAny(header, "\r\n\x00") || resource == nil {
		return model.DAVCondition{}, model.ErrInvalid
	}
	p := &ifParser{text: header}
	result := model.DAVCondition{RequestPath: requestPath}
	p.space()
	tagged := p.peek() == '<'
	for p.position < len(p.text) {
		path := ""
		if tagged {
			tag, err := p.angle()
			if err != nil {
				return model.DAVCondition{}, err
			}
			path, err = resource(tag)
			if err != nil {
				return model.DAVCondition{}, err
			}
			p.space()
		}
		listCount := 0
		for p.peek() == '(' {
			list, err := p.list()
			if err != nil {
				return model.DAVCondition{}, err
			}
			list.Resource = path
			result.Lists = append(result.Lists, list)
			listCount++
			if len(result.Lists) > model.MaxDAVConditionLists {
				return model.DAVCondition{}, model.ErrTooLarge
			}
			p.space()
		}
		if listCount == 0 || !tagged && p.position < len(p.text) || tagged && p.position < len(p.text) && p.peek() != '<' {
			return model.DAVCondition{}, model.ErrInvalid
		}
	}
	if len(result.Lists) == 0 {
		return model.DAVCondition{}, model.ErrInvalid
	}
	if err := result.Validate(); err != nil {
		return model.DAVCondition{}, err
	}
	return result, nil
}

type ifParser struct {
	text     string
	position int
	count    int
}

func (p *ifParser) peek() byte {
	if p.position >= len(p.text) {
		return 0
	}
	return p.text[p.position]
}
func (p *ifParser) space() {
	for p.peek() == ' ' || p.peek() == '\t' {
		p.position++
	}
}
func (p *ifParser) angle() (string, error) {
	if p.peek() != '<' {
		return "", model.ErrInvalid
	}
	p.position++
	start := p.position
	for p.peek() != 0 && p.peek() != '>' {
		if p.peek() <= ' ' || p.peek() == '<' {
			return "", model.ErrInvalid
		}
		p.position++
	}
	if p.peek() != '>' || start == p.position {
		return "", model.ErrInvalid
	}
	value := p.text[start:p.position]
	p.position++
	return value, nil
}
func (p *ifParser) list() (model.DAVConditionList, error) {
	result := model.DAVConditionList{}
	p.position++
	p.space()
	for p.peek() != ')' {
		if p.peek() == 0 {
			return result, model.ErrInvalid
		}
		condition := model.DAVStateCondition{}
		if strings.HasPrefix(p.text[p.position:], "Not") {
			p.position += len("Not")
			if p.peek() != ' ' && p.peek() != '\t' {
				return result, model.ErrInvalid
			}
			p.space()
			condition.Not = true
		}
		if p.peek() == '<' {
			token, err := p.angle()
			if err != nil {
				return result, err
			}
			uri, err := url.Parse(token)
			if err != nil || uri.Scheme == "" || uri.User != nil {
				return result, model.ErrInvalid
			}
			condition.Token = token
		} else if p.peek() == '[' {
			p.position++
			start := p.position
			if strings.HasPrefix(p.text[p.position:], "W/") {
				p.position += 2
			}
			if p.peek() != '"' {
				return result, model.ErrInvalid
			}
			p.position++
			for p.peek() != '"' {
				if p.peek() < '!' || p.peek() == 127 {
					return result, model.ErrInvalid
				}
				p.position++
			}
			p.position++
			condition.ETag = p.text[start:p.position]
			if p.peek() != ']' {
				return result, model.ErrInvalid
			}
			p.position++
		} else {
			return result, model.ErrInvalid
		}
		p.count++
		if p.count > model.MaxDAVConditions {
			return result, model.ErrTooLarge
		}
		result.Conditions = append(result.Conditions, condition)
		p.space()
	}
	p.position++
	if len(result.Conditions) == 0 {
		return result, model.ErrInvalid
	}
	return result, nil
}
