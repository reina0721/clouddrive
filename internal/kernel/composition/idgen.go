package composition

import (
	"fmt"

	"github.com/reina0721/clouddrive/internal/kernel/app"
	idgenapp "github.com/reina0721/clouddrive/internal/kernel/app/idgen"
	pkgidgen "github.com/reina0721/clouddrive/pkg/idgen"
)

func composeIDGenerator(plan *app.Plan) (app.Added[pkgidgen.Generator], error) {
	added, err := app.Add(plan, idgenapp.UUID())
	if err != nil {
		return app.Added[pkgidgen.Generator]{}, fmt.Errorf("compose ID generator app: %w", err)
	}
	return added, nil
}
