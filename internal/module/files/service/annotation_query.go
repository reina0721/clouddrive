package service

import (
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"strings"
)

type PropertyMatch string

const (
	PropertyExists   PropertyMatch = "exists"
	PropertyEquals   PropertyMatch = "equals"
	PropertyContains PropertyMatch = "contains"
)

type AnnotationPropertyFilter struct {
	Key   string
	Match PropertyMatch
	Value string
}

func (s *Service) prepareAnnotationQuery(q Query) (Query, error) {
	if len(q.Tags) > model.MaxAnnotationTags {
		return Query{}, model.ErrTooLarge
	}
	if len(q.Tags) == 0 && q.TagMatch != "" {
		return Query{}, model.ErrInvalid
	}
	if len(q.Tags) > 0 {
		if q.TagMatch == "" {
			q.TagMatch = MatchAll
		}
		if q.TagMatch != MatchAll && q.TagMatch != MatchAny {
			return Query{}, model.ErrInvalid
		}
		q.Tags = append([]string(nil), q.Tags...)
		seen := map[string]bool{}
		for index, name := range q.Tags {
			name = s.names.Normalize(name)
			if name == "" || strings.TrimSpace(name) != name || !model.ValidAnnotationText(name, model.MaxTagNameRunes) {
				return Query{}, model.ErrInvalid
			}
			name = strings.ToLower(name)
			if seen[name] {
				return Query{}, model.ErrInvalid
			}
			seen[name] = true
			q.Tags[index] = name
		}
	}
	if q.Property != nil {
		property := *q.Property
		property.Key = s.names.Normalize(property.Key)
		property.Value = s.names.Normalize(property.Value)
		if !model.ValidPropertyKey(property.Key) || !model.ValidPropertyValue(property.Value) {
			return Query{}, model.ErrInvalid
		}
		if property.Match == "" {
			property.Match = PropertyExists
		}
		if property.Match != PropertyExists && property.Match != PropertyEquals && property.Match != PropertyContains {
			return Query{}, model.ErrInvalid
		}
		if property.Match == PropertyExists && property.Value != "" {
			return Query{}, model.ErrInvalid
		}
		if !q.CaseSensitive {
			property.Value = strings.ToLower(property.Value)
		}
		q.Property = &property
	}
	return q, nil
}

func (s *Service) matchesAnnotationQuery(value model.Annotations, q Query) bool {
	if len(q.Tags) > 0 {
		existing := map[string]bool{}
		for _, tag := range value.Tags {
			existing[strings.ToLower(s.names.Normalize(tag.Name))] = true
		}
		matched := q.TagMatch == MatchAll
		for _, name := range q.Tags {
			if q.TagMatch == MatchAll && !existing[name] {
				matched = false
				break
			}
			if q.TagMatch == MatchAny && existing[name] {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}
	if q.Property != nil {
		matched := false
		for _, property := range value.Properties {
			if s.names.Normalize(property.Key) != q.Property.Key {
				continue
			}
			text := s.names.Normalize(property.Value)
			if !q.CaseSensitive {
				text = strings.ToLower(text)
			}
			switch q.Property.Match {
			case PropertyExists:
				matched = true
			case PropertyEquals:
				matched = text == q.Property.Value
			case PropertyContains:
				matched = strings.Contains(text, q.Property.Value)
			}
			break
		}
		if !matched {
			return false
		}
	}
	return true
}
