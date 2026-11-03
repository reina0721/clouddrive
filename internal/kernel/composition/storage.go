package composition

import (
	"fmt"

	"github.com/reina0721/clouddrive/internal/kernel/app"
	storageapp "github.com/reina0721/clouddrive/internal/kernel/app/storage"
)

func composeStorage(plan *app.Plan) (app.Added[storageapp.Access], error) {
	definition, err := storageapp.Definition()
	if err != nil {
		return app.Added[storageapp.Access]{}, fmt.Errorf("define storage app: %w", err)
	}
	added, err := app.Add(plan, definition)
	if err != nil {
		return app.Added[storageapp.Access]{}, fmt.Errorf("compose storage app: %w", err)
	}
	return added, nil
}
