package service

import (
	"context"
	"errors"
	"fmt"
	"path"
	"regexp"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	maxStorageRuleExtensions     = 32
	maxStorageRuleExtensionRunes = 32
	maxStorageRulePatternBytes   = 256
)

type StorageRuleMode string

const (
	StorageRuleAllow StorageRuleMode = "allow"
	StorageRuleDeny  StorageRuleMode = "deny"
)

type StorageNameRules struct {
	ExtensionMode StorageRuleMode `json:"extensionMode" enum:"allow,deny"`
	Extensions    []string        `json:"extensions" maxItems:"32"`
	PatternMode   StorageRuleMode `json:"patternMode" enum:"allow,deny"`
	Pattern       string          `json:"pattern" maxLength:"256"`
}

type StorageNameRuleDecision string

const (
	StorageNameAllowed         StorageNameRuleDecision = "allowed"
	StorageNameExtensionDenied StorageNameRuleDecision = "extension"
	StorageNamePatternDenied   StorageNameRuleDecision = "pattern"
)

// FileNameAdmission 是应用代私有、不可变的已编译规则。零值表示不限。
type FileNameAdmission struct {
	rules   StorageNameRules
	pattern *regexp.Regexp
}

func validStorageRuleMode(mode StorageRuleMode) bool {
	return mode == StorageRuleAllow || mode == StorageRuleDeny
}

func CompileStorageNameRules(input StorageNameRules) (FileNameAdmission, error) {
	if !validStorageRuleMode(input.ExtensionMode) || !validStorageRuleMode(input.PatternMode) ||
		len(input.Extensions) > maxStorageRuleExtensions || len(input.Pattern) > maxStorageRulePatternBytes || !utf8.ValidString(input.Pattern) {
		return FileNameAdmission{}, model.ErrInvalid
	}
	extensions := make([]string, 0, len(input.Extensions))
	for _, raw := range input.Extensions {
		extension := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(raw), "."))
		if extension == "" || !utf8.ValidString(extension) || utf8.RuneCountInString(extension) > maxStorageRuleExtensionRunes ||
			strings.IndexFunc(extension, func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsNumber(r) && r != '_' && r != '-' }) >= 0 {
			return FileNameAdmission{}, model.ErrInvalid
		}
		extensions = append(extensions, extension)
	}
	slices.Sort(extensions)
	input.Extensions = slices.Compact(extensions)
	if len(input.Extensions) == 0 {
		input.ExtensionMode = StorageRuleAllow
	}
	if input.Pattern == "" {
		input.PatternMode = StorageRuleAllow
		return FileNameAdmission{rules: input}, nil
	}
	pattern, err := regexp.Compile(input.Pattern)
	if err != nil {
		return FileNameAdmission{}, errors.Join(model.ErrInvalid, err)
	}
	return FileNameAdmission{rules: input, pattern: pattern}, nil
}

func (r FileNameAdmission) decision(name string) StorageNameRuleDecision {
	if len(r.rules.Extensions) > 0 {
		extension := strings.ToLower(strings.TrimPrefix(path.Ext(name), "."))
		_, matched := slices.BinarySearch(r.rules.Extensions, extension)
		if matched != (r.rules.ExtensionMode == StorageRuleAllow) {
			return StorageNameExtensionDenied
		}
	}
	if r.pattern != nil && r.pattern.MatchString(name) != (r.rules.PatternMode == StorageRuleAllow) {
		return StorageNamePatternDenied
	}
	return StorageNameAllowed
}

func (r FileNameAdmission) validate(name string) error {
	if r.decision(name) != StorageNameAllowed {
		return model.ErrFilenameRestricted
	}
	return nil
}

type StoredStorageNameRules struct {
	Revision int64            `json:"revision" minimum:"0" maximum:"9007199254740991"`
	Rules    StorageNameRules `json:"rules"`
}

type StorageNameRulesView struct {
	StoredStorageNameRules
	Active         StorageNameRules `json:"active"`
	PendingRestart bool             `json:"pendingRestart"`
}

type StorageNameRulesRepository interface {
	ReadStorageNameRules(context.Context) (StoredStorageNameRules, error)
	SaveStorageNameRules(context.Context, StoredStorageNameRules) (StoredStorageNameRules, error)
}

type StorageNameRuleSettings struct {
	store  StorageNameRulesRepository
	active StorageNameRules
}

func NewStorageNameRuleSettings(ctx context.Context, store StorageNameRulesRepository) (*StorageNameRuleSettings, FileNameAdmission, error) {
	if store == nil {
		return nil, FileNameAdmission{}, fmt.Errorf("storage name rules repository is required")
	}
	stored, err := store.ReadStorageNameRules(ctx)
	if err != nil {
		return nil, FileNameAdmission{}, err
	}
	active, err := CompileStorageNameRules(stored.Rules)
	if err != nil {
		return nil, FileNameAdmission{}, err
	}
	return &StorageNameRuleSettings{store: store, active: active.rules}, active, nil
}

func (s *StorageNameRuleSettings) view(stored StoredStorageNameRules) StorageNameRulesView {
	rules, active := stored.Rules, s.active
	active.Extensions = append([]string{}, active.Extensions...)
	return StorageNameRulesView{StoredStorageNameRules: stored, Active: active,
		PendingRestart: rules.ExtensionMode != active.ExtensionMode || !slices.Equal(rules.Extensions, active.Extensions) ||
			rules.PatternMode != active.PatternMode || rules.Pattern != active.Pattern}
}

func (s *StorageNameRuleSettings) Read(ctx context.Context) (StorageNameRulesView, error) {
	stored, err := s.store.ReadStorageNameRules(ctx)
	if err != nil {
		return StorageNameRulesView{}, err
	}
	return s.view(stored), nil
}

func (s *StorageNameRuleSettings) Save(ctx context.Context, input StoredStorageNameRules) (StorageNameRulesView, error) {
	if input.Revision < 0 || input.Revision >= model.MaxPreferenceRevision {
		return StorageNameRulesView{}, model.ErrInvalid
	}
	compiled, err := CompileStorageNameRules(input.Rules)
	if err != nil {
		return StorageNameRulesView{}, err
	}
	input.Rules = compiled.rules
	stored, err := s.store.SaveStorageNameRules(ctx, input)
	if err != nil {
		return StorageNameRulesView{}, err
	}
	return s.view(stored), nil
}

func PreviewStorageNameRules(name string, rules StorageNameRules) (StorageNameRuleDecision, error) {
	if err := model.ValidateName(name); err != nil {
		return "", err
	}
	compiled, err := CompileStorageNameRules(rules)
	if err != nil {
		return "", err
	}
	return compiled.decision(name), nil
}
