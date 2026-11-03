package model

import (
	"errors"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/idgen"
)

func TestDepartmentNormalizesCodeAndRejectsSelfParent(t *testing.T) {
	id, _ := idgen.UUID().New()
	department, err := NewDepartment(id, " Platform ", "平台部", nil, time.Now())
	if err != nil || department.Code != "platform" {
		t.Fatalf("department = %#v, %v", department, err)
	}
	if _, err := NewDepartment(id, "platform", "平台部", &id, time.Now()); !errors.Is(err, ErrCycle) {
		t.Fatalf("self parent error = %v", err)
	}
}

func TestPositionRejectsInvalidCodeAndName(t *testing.T) {
	id, _ := idgen.UUID().New()
	if _, err := NewPosition(id, "bad code", "岗位", time.Now()); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("code error = %v", err)
	}
	if _, err := NewPosition(id, "engineer", "", time.Now()); !errors.Is(err, ErrInvalidName) {
		t.Fatalf("name error = %v", err)
	}
}
