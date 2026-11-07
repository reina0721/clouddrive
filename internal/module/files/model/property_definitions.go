package model

import (
	"encoding/json"
	"math"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"
)

const (
	MaxPropertyDefinitions = 32
	MaxPropertyOptions     = 16
	MaxPropertyOptionRunes = 64
	DefaultRatingMaximum   = 5
	MaxRatingMaximum       = 20
)

type PropertyKind string

const (
	PropertyText        PropertyKind = "text"
	PropertyNumber      PropertyKind = "number"
	PropertyCheckbox    PropertyKind = "checkbox"
	PropertySelect      PropertyKind = "select"
	PropertyMultiSelect PropertyKind = "multi-select"
	PropertyLink        PropertyKind = "link"
	PropertyRating      PropertyKind = "rating"
)

type PropertyDefinition struct {
	Key          string       `json:"key" minLength:"1" maxLength:"64"`
	Name         string       `json:"name" minLength:"1" maxLength:"64"`
	Kind         PropertyKind `json:"kind" enum:"text,number,checkbox,select,multi-select,link,rating"`
	Minimum      *float64     `json:"minimum,omitempty"`
	Maximum      *float64     `json:"maximum,omitempty"`
	Options      []string     `json:"options,omitempty" maxItems:"16"`
	DefaultValue *string      `json:"defaultValue,omitempty" maxLength:"256"`
}

type PropertyDefinitionSet struct {
	Revision int64                `json:"revision" minimum:"0" maximum:"9007199254740991"`
	Items    []PropertyDefinition `json:"items" maxItems:"32"`
}

var managedPropertyKey = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
var decimalPropertyValue = regexp.MustCompile(`^-?[0-9]+(?:\.[0-9]+)?$`)

func validPropertyBound(value *float64) bool {
	return value == nil || !math.IsNaN(*value) && !math.IsInf(*value, 0)
}

func propertyNumberWithin(value float64, minimum, maximum *float64) bool {
	return (minimum == nil || value >= *minimum) && (maximum == nil || value <= *maximum)
}

func (d PropertyDefinition) Validate() error {
	if !managedPropertyKey.MatchString(d.Key) || d.Name == "" || strings.TrimSpace(d.Name) != d.Name ||
		!ValidAnnotationText(d.Name, MaxPropertyKeyRunes) || !validPropertyBound(d.Minimum) || !validPropertyBound(d.Maximum) ||
		(d.Minimum != nil && d.Maximum != nil && *d.Minimum > *d.Maximum) {
		return ErrInvalid
	}
	if d.Kind != PropertySelect && d.Kind != PropertyMultiSelect && len(d.Options) != 0 {
		return ErrInvalid
	}
	switch d.Kind {
	case PropertyText:
		for _, bound := range []*float64{d.Minimum, d.Maximum} {
			if bound != nil && (*bound < 0 || *bound > MaxPropertyValueRunes || math.Trunc(*bound) != *bound) {
				return ErrInvalid
			}
		}
	case PropertyNumber:
	case PropertyRating:
		if d.Minimum != nil || d.Maximum != nil && (*d.Maximum < 1 || *d.Maximum > MaxRatingMaximum || math.Trunc(*d.Maximum) != *d.Maximum) {
			return ErrInvalid
		}
	case PropertyCheckbox, PropertySelect, PropertyMultiSelect, PropertyLink:
		if d.Minimum != nil || d.Maximum != nil {
			return ErrInvalid
		}
	default:
		return ErrInvalid
	}
	if d.Kind == PropertySelect || d.Kind == PropertyMultiSelect {
		if len(d.Options) == 0 || len(d.Options) > MaxPropertyOptions {
			return ErrInvalid
		}
		seen := make(map[string]bool, len(d.Options))
		for _, option := range d.Options {
			if option == "" || strings.TrimSpace(option) != option || !ValidAnnotationText(option, MaxPropertyOptionRunes) || seen[option] {
				return ErrInvalid
			}
			seen[option] = true
		}
	}
	if d.DefaultValue != nil {
		return d.ValidateValue(*d.DefaultValue)
	}
	return nil
}

func (d PropertyDefinition) ValidateValue(value string) error {
	if !ValidPropertyValue(value) {
		return ErrInvalid
	}
	switch d.Kind {
	case PropertyText:
		if propertyNumberWithin(float64(utf8.RuneCountInString(value)), d.Minimum, d.Maximum) {
			return nil
		}
	case PropertyNumber:
		number, err := strconv.ParseFloat(value, 64)
		if err == nil && decimalPropertyValue.MatchString(value) && propertyNumberWithin(number, d.Minimum, d.Maximum) {
			return nil
		}
	case PropertyCheckbox:
		if value == "true" || value == "false" {
			return nil
		}
	case PropertySelect:
		if slices.Contains(d.Options, value) {
			return nil
		}
	case PropertyMultiSelect:
		var selected []string
		if err := json.Unmarshal([]byte(value), &selected); err != nil || selected == nil || len(selected) > len(d.Options) {
			return ErrInvalid
		}
		seen := make(map[string]bool, len(selected))
		for _, option := range selected {
			if seen[option] || !slices.Contains(d.Options, option) {
				return ErrInvalid
			}
			seen[option] = true
		}
		return nil
	case PropertyLink:
		link, err := url.Parse(value)
		if err == nil && (link.Scheme == "http" || link.Scheme == "https") && link.Hostname() != "" && link.User == nil &&
			strings.TrimSpace(value) == value && !strings.ContainsAny(value, "\r\n\t") {
			return nil
		}
	case PropertyRating:
		maximum := DefaultRatingMaximum
		if d.Maximum != nil {
			maximum = int(*d.Maximum)
		}
		rating, err := strconv.Atoi(value)
		if err == nil && strconv.Itoa(rating) == value && rating >= 1 && rating <= maximum {
			return nil
		}
	}
	return ErrInvalid
}

func (s PropertyDefinitionSet) Validate() error {
	if s.Revision < 0 || s.Revision > MaxAnnotationRevision || s.Items == nil || len(s.Items) > MaxPropertyDefinitions {
		return ErrInvalid
	}
	seen := make(map[string]bool, len(s.Items))
	for _, definition := range s.Items {
		if err := definition.Validate(); err != nil {
			return err
		}
		if seen[definition.Key] {
			return ErrInvalid
		}
		seen[definition.Key] = true
	}
	return nil
}
