package model

import (
	"encoding/json"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	MaxAnnotationBytes            = 2048
	MaxAnnotationTags             = 8
	MaxAnnotationProperties       = 8
	MaxTagNameRunes               = 32
	MaxPropertyKeyRunes           = 64
	MaxPropertyValueRunes         = 256
	MaxEmojiRunes                 = 16
	MaxEmojiBytes                 = 64
	MaxAnnotationRevision   int64 = 1<<53 - 1
	DefaultTagColor               = "#3b82f6"
)

type Tag struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}
type Property struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// Annotations 是私有条目的整理信息，不承载系统元数据或外部授权。
type Annotations struct {
	Tags        []Tag      `json:"tags,omitempty"`
	Properties  []Property `json:"properties,omitempty"`
	Emoji       string     `json:"emoji,omitempty"`
	FolderColor string     `json:"folderColor,omitempty"`
}

var annotationColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func ValidAnnotationColor(value string) bool { return annotationColorPattern.MatchString(value) }

func ValidAnnotationText(value string, maxRunes int) bool {
	if !utf8.ValidString(value) || utf8.RuneCountInString(value) > maxRunes {
		return false
	}
	for _, character := range value {
		if unicode.IsControl(character) {
			return false
		}
	}
	return true
}

func ValidPropertyKey(value string) bool {
	if value == "" || !ValidAnnotationText(value, MaxPropertyKeyRunes) {
		return false
	}
	for _, character := range value {
		if !unicode.IsLetter(character) && !unicode.IsDigit(character) && character != '_' && character != '-' && character != '.' {
			return false
		}
	}
	return true
}

func ValidPropertyValue(value string) bool {
	if !utf8.ValidString(value) || utf8.RuneCountInString(value) > MaxPropertyValueRunes {
		return false
	}
	for _, character := range value {
		if unicode.IsControl(character) && character != '\n' && character != '\r' && character != '\t' {
			return false
		}
	}
	return true
}

// CloneAnnotations 保证目录副本和编辑草稿不共享可变slice。
func CloneAnnotations(value Annotations) Annotations {
	value.Tags = append([]Tag(nil), value.Tags...)
	value.Properties = append([]Property(nil), value.Properties...)
	return value
}

// ValidateAnnotations 的编码字节预算包括JSON转义，不能仅按用户字符数估算。
func ValidateAnnotations(value Annotations, maxBytes int) error {
	if maxBytes < 1 || maxBytes > MaxAnnotationBytes || len(value.Tags) > MaxAnnotationTags || len(value.Properties) > MaxAnnotationProperties {
		return ErrTooLarge
	}
	if !ValidAnnotationText(value.Emoji, MaxEmojiRunes) || len(value.Emoji) > MaxEmojiBytes || strings.TrimSpace(value.Emoji) != value.Emoji {
		return ErrInvalid
	}
	if value.FolderColor != "" && !ValidAnnotationColor(value.FolderColor) {
		return ErrInvalid
	}
	tags := map[string]bool{}
	for _, tag := range value.Tags {
		key := strings.ToLower(tag.Name)
		if tag.Name == "" || strings.TrimSpace(tag.Name) != tag.Name || !ValidAnnotationText(tag.Name, MaxTagNameRunes) || !ValidAnnotationColor(tag.Color) || tags[key] {
			return ErrInvalid
		}
		tags[key] = true
	}
	properties := map[string]bool{}
	for _, property := range value.Properties {
		if !ValidPropertyKey(property.Key) || !ValidPropertyValue(property.Value) || properties[property.Key] {
			return ErrInvalid
		}
		properties[property.Key] = true
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if len(encoded) > maxBytes {
		return ErrTooLarge
	}
	return nil
}
