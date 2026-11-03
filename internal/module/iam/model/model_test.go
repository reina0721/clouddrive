package model

import (
	"errors"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/idgen"
)

func TestNormalizeUsername(t *testing.T) {
	got, err := NormalizeUsername(" Owner_01 ")
	if err != nil || got != "owner_01" {
		t.Fatalf("NormalizeUsername() = %q, %v", got, err)
	}
	if _, err := NormalizeUsername("含中文"); !errors.Is(err, ErrInvalidUsername) {
		t.Fatalf("error = %v", err)
	}
}

func TestNewAccountStartsAtSecurityRevisionOne(t *testing.T) {
	id, _ := idgen.UUID().New()
	account, err := NewAccount(id, "owner", "系统所有者", false, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if account.SecurityRevision != 1 || account.Status != AccountActive {
		t.Fatalf("account = %#v", account)
	}
}

func TestValidatePasswordRuneBounds(t *testing.T) {
	if !errors.Is(ValidatePassword("short"), ErrInvalidPassword) {
		t.Fatal("short password accepted")
	}
	if err := ValidatePassword("123456789012345"); err != nil {
		t.Fatal(err)
	}
}
