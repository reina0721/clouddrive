package composition

import (
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/console"
	"strings"
)

// consoleRuntime exposes only an explicit allowlist of non-secret operational
// configuration. DSNs, identities, setup tokens, signing keys and webhook URLs
// never cross this projection, even if the generic redactor changes later.
func (g *applicationGeneration) consoleRuntime() console.RuntimeMetadata {
	data := g.snapshot.Redacted()
	result := console.RuntimeMetadata{Configuration: []console.RuntimeField{}, Capabilities: append(append([]string{}, g.resourceStats.Built...), g.resourceStats.Reused...)}
	for _, path := range []string{"logger.environment", "auth.mode", "database.driver", "cache.driver", "storage.driver", "scheduler.enabled", "scheduler.timezone", "scheduler.maxConcurrency", "http.addr", "management.addr", "management.metricsAccess", "alerting.enabled", "alerting.timeout", "alerting.retries", "alerting.queueSize", "console.relay.maxTimeout", "console.relay.maxResponseBytes"} {
		var value any = data
		for _, part := range strings.Split(path, ".") {
			object, ok := value.(map[string]any)
			if !ok {
				value = nil
				break
			}
			value = object[part]
		}
		if value != nil {
			result.Configuration = append(result.Configuration, console.RuntimeField{Name: path, Value: fmt.Sprint(value)})
		}
	}
	return result
}
