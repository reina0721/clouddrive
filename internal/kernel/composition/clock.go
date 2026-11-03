package composition

import (
	"fmt"

	"github.com/reina0721/clouddrive/internal/kernel/app"
	clockapp "github.com/reina0721/clouddrive/internal/kernel/app/clock"
	pkgclock "github.com/reina0721/clouddrive/pkg/clock"
)

func composeClock(plan *app.Plan) (app.Added[pkgclock.Clock], error) {
	added, err := app.Add(plan, clockapp.System())
	if err != nil {
		return app.Added[pkgclock.Clock]{}, fmt.Errorf("compose clock app: %w", err)
	}
	return added, nil
}
