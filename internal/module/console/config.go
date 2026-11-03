package console

import (
	"context"
	"fmt"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	"net/url"
)

type Config struct {
	Relay RelayPolicy `mapstructure:"relay"`
}

func Binding() config.Binding {
	return config.Binding{CapabilityID: "module.console", ConfigPath: "console", Contract: defaults{}, Validate: func(snapshot config.Snapshot) error { _, err := Decode(snapshot); return err }}
}
func Decode(snapshot config.Snapshot) (Config, error) {
	value := Config{Relay: DefaultRelayPolicy()}
	if err := snapshot.DecodeSection("console", &value); err != nil {
		return Config{}, err
	}
	if value.Relay.MaxTimeout <= 0 || value.Relay.MaxResponseBytes < 1 || value.Relay.MaxResponseBytes > 16<<20 {
		return Config{}, fmt.Errorf("console relay budgets are invalid")
	}
	for _, origin := range append(append([]string{}, value.Relay.AllowedOrigins...), value.Relay.ProxyOrigins...) {
		u, err := url.Parse(origin)
		if err != nil || u.Host == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || (u.Scheme != "http" && u.Scheme != "https") {
			return Config{}, fmt.Errorf("console relay origin is invalid")
		}
	}
	return value, nil
}

type defaults struct{}

func (defaults) Defaults(ctx context.Context) (config.Object, config.Control, error) {
	if ctx == nil {
		return nil, config.Continue, fmt.Errorf("console context is nil")
	}
	number, err := config.Number("2097152")
	if err != nil {
		return nil, config.Continue, err
	}
	return config.Object{config.FieldOf("relay", config.ObjectValue(config.Object{
		config.FieldOf("allowedOrigins", config.List()), config.FieldOf("proxyOrigins", config.List()), config.FieldOf("maxTimeout", config.String("30s")), config.FieldOf("maxResponseBytes", number),
	}))}, config.Continue, nil
}
