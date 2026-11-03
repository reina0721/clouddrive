// Package model 定义组织目录的部门、岗位与账号分配模型。
package model

import (
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/pkg/idgen"
)

const (
	MaxTreeDepth = 8
	MaxNameRunes = 128
)

var (
	ErrInvalidID   = errors.New("organization id is invalid")
	ErrInvalidCode = errors.New("organization code is invalid")
	ErrInvalidName = errors.New("organization name is invalid")
	ErrInvalidTime = errors.New("organization time is invalid")
	// ErrInvalidQuery 表示列表查询参数非法（分页/过滤）；090 BE-090-001
	// 统一语义：非法查询返回可识别错误，不静默忽略。
	ErrInvalidQuery   = errors.New("organization list query is invalid")
	ErrCycle          = errors.New("organization department cycle")
	ErrDepthExceeded  = errors.New("organization department depth exceeded")
	ErrReferenced     = errors.New("organization resource is referenced")
	ErrAccountInvalid = errors.New("organization account is not assignable")
	codePattern       = regexp.MustCompile(`^[a-z][a-z0-9._-]{1,63}$`)
)

type Department struct {
	Leader, Remark       string
	MemberCount          int64
	ID, Code, Name       string
	ParentID             *string
	Active, Archived     bool
	Version              uint64
	CreatedAt, UpdatedAt time.Time
}

type Position struct {
	ID, Code, Name       string
	Active, Archived     bool
	Version              uint64
	CreatedAt, UpdatedAt time.Time
}

type Assignment struct {
	AccountID    string
	DepartmentID *string
	PositionIDs  []string
	Version      uint64
}

func NewDepartment(id, code, name string, parentID *string, now time.Time) (Department, error) {
	if err := validateBase(id, code, name, now); err != nil {
		return Department{}, err
	}
	parent, err := normalizeOptionalID(parentID)
	if err != nil {
		return Department{}, err
	}
	if parent != nil && *parent == id {
		return Department{}, ErrCycle
	}
	return Department{ID: id, Code: normalizeCode(code), Name: strings.TrimSpace(name), ParentID: parent, Active: true, Version: 1, CreatedAt: now.UTC(), UpdatedAt: now.UTC()}, nil
}

func NewPosition(id, code, name string, now time.Time) (Position, error) {
	if err := validateBase(id, code, name, now); err != nil {
		return Position{}, err
	}
	return Position{ID: id, Code: normalizeCode(code), Name: strings.TrimSpace(name), Active: true, Version: 1, CreatedAt: now.UTC(), UpdatedAt: now.UTC()}, nil
}

func NormalizeCode(value string) (string, error) {
	value = normalizeCode(value)
	if !codePattern.MatchString(value) {
		return "", ErrInvalidCode
	}
	return value, nil
}

func NormalizeName(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len([]rune(value)) > MaxNameRunes {
		return "", ErrInvalidName
	}
	return value, nil
}

func validateBase(id, code, name string, now time.Time) error {
	if err := idgen.Validate(id); err != nil {
		return ErrInvalidID
	}
	if _, err := NormalizeCode(code); err != nil {
		return err
	}
	if _, err := NormalizeName(name); err != nil {
		return err
	}
	if now.IsZero() {
		return ErrInvalidTime
	}
	return nil
}

func normalizeCode(value string) string { return strings.ToLower(strings.TrimSpace(value)) }

func normalizeOptionalID(value *string) (*string, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}
	normalized := strings.TrimSpace(*value)
	if err := idgen.Validate(normalized); err != nil {
		return nil, ErrInvalidID
	}
	return &normalized, nil
}
