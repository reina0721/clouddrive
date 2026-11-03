package composition

import (
	"fmt"

	"github.com/reina0721/clouddrive/internal/kernel/app"
	validationapp "github.com/reina0721/clouddrive/internal/kernel/app/validation"
	pkgvalidation "github.com/reina0721/clouddrive/pkg/validation"
)

func composeValidator(plan *app.Plan) (app.Added[pkgvalidation.Validator], error) {
	added, err := app.Add(plan, validationapp.Default())
	if err != nil {
		return app.Added[pkgvalidation.Validator]{}, fmt.Errorf("compose validation app: %w", err)
	}
	return added, nil
}
