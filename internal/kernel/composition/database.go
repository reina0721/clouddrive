package composition

import (
	"fmt"

	"github.com/reina0721/clouddrive/internal/kernel/app"
	databaseapp "github.com/reina0721/clouddrive/internal/kernel/app/database"
)

func composeDatabase(plan *app.Plan) (app.Added[databaseapp.Access], error) {
	definition, err := databaseapp.Definition()
	if err != nil {
		return app.Added[databaseapp.Access]{}, fmt.Errorf("define database app: %w", err)
	}
	added, err := app.Add(plan, definition)
	if err != nil {
		return app.Added[databaseapp.Access]{}, fmt.Errorf("compose database app: %w", err)
	}
	return added, nil
}
