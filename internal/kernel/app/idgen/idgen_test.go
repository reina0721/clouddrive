package idgen

import (
	"testing"

	"github.com/reina0721/clouddrive/internal/kernel/app"
	pkgidgen "github.com/reina0721/clouddrive/pkg/idgen"
)

func TestUUIDProvidesDirectGenerator(t *testing.T) {
	plan := app.NewPlan()
	added, err := app.Add(plan, UUID())
	if err != nil {
		t.Fatalf("Add() error = %v", err)
	}
	var output pkgidgen.Generator = added.Output
	value, err := output.New()
	if err != nil || value == "" {
		t.Fatalf("Generator.New() = %q, %v", value, err)
	}
}
