package repo

import (
	"context"

	"github.com/reina0721/clouddrive/internal/module/files/service"
)

const fileIconRulesID = "file-icon-rules"

type fileIconRulesRecord struct {
	Inherit bool                   `json:"inherit"`
	Items   []service.FileIconRule `json:"items"`
}

func (r *Repository) ReadFileIconRules(ctx context.Context) (service.FileIconRuleSet, error) {
	revision, value, err := readFileSettings[fileIconRulesRecord](ctx, r, fileIconRulesID)
	return service.FileIconRuleSet{
		Revision: revision, Inherit: revision == 0 || value.Inherit, Items: value.Items,
	}, err
}

func (r *Repository) SaveFileIconRules(ctx context.Context, value service.FileIconRuleSet) (service.FileIconRuleSet, error) {
	expected := value.Revision
	value.Revision++
	return value, r.saveFileSettings(ctx, fileIconRulesID, expected, value.Revision,
		fileIconRulesRecord{Inherit: value.Inherit, Items: value.Items})
}
