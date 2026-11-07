package service

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type PropertyDefinitionRepository interface {
	ReadPropertyDefinitions(context.Context) (model.PropertyDefinitionSet, error)
	SavePropertyDefinitions(context.Context, model.PropertyDefinitionSet) (model.PropertyDefinitionSet, error)
}

type PropertyDefinitions struct {
	repository PropertyDefinitionRepository
	names      NameNormalizer
}

func NewPropertyDefinitions(repository PropertyDefinitionRepository, names NameNormalizer) (*PropertyDefinitions, error) {
	if repository == nil || names == nil {
		return nil, fmt.Errorf("property definition dependencies are required")
	}
	return &PropertyDefinitions{repository: repository, names: names}, nil
}

func (s *PropertyDefinitions) Read(ctx context.Context) (model.PropertyDefinitionSet, error) {
	return s.repository.ReadPropertyDefinitions(ctx)
}

func (s *PropertyDefinitions) Save(ctx context.Context, input model.PropertyDefinitionSet) (model.PropertyDefinitionSet, error) {
	input.Items = slices.Clone(input.Items)
	for index, definition := range input.Items {
		definition.Name = s.names.Normalize(definition.Name)
		definition.Options = slices.Clone(definition.Options)
		for index, option := range definition.Options {
			definition.Options[index] = s.names.Normalize(option)
		}
		if definition.DefaultValue != nil {
			value := s.names.Normalize(*definition.DefaultValue)
			if definition.Kind == model.PropertyMultiSelect {
				var selected []string
				if err := json.Unmarshal([]byte(value), &selected); err != nil {
					return model.PropertyDefinitionSet{}, fmt.Errorf("parse multiple property defaults: %w: %w", model.ErrInvalid, err)
				}
				for index, option := range selected {
					selected[index] = s.names.Normalize(option)
				}
				encoded, err := json.Marshal(selected)
				if err != nil {
					return model.PropertyDefinitionSet{}, fmt.Errorf("encode multiple property defaults: %w", err)
				}
				value = string(encoded)
			}
			definition.DefaultValue = &value
		}
		input.Items[index] = definition
	}
	if err := input.Validate(); err != nil {
		return model.PropertyDefinitionSet{}, err
	}
	if input.Revision == model.MaxAnnotationRevision {
		return model.PropertyDefinitionSet{}, model.ErrConflict
	}
	return s.repository.SavePropertyDefinitions(ctx, input)
}
