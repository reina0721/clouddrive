package configbinding

import (
	"context"
	"fmt"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

func offlineDefaults(ctx context.Context) (config.Object, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	p := service.DefaultDownloadPolicy()
	fields := config.Object{config.FieldOf("enabled", config.Bool(p.Enabled)), config.FieldOf("dispatchInterval", config.String(p.DispatchInterval.String())), config.FieldOf("leaseTTL", config.String(p.LeaseTTL.String())), config.FieldOf("renewInterval", config.String(p.RenewInterval.String())), config.FieldOf("progressInterval", config.String(p.ProgressInterval.String())), config.FieldOf("attemptTimeout", config.String(p.AttemptTimeout.String()))}
	for _, budget := range []struct {
		name  string
		value int64
	}{{"batchEntries", int64(p.BatchEntries)}, {"ownerRecords", int64(p.OwnerRecords)}, {"globalRecords", int64(p.GlobalRecords)}, {"concurrency", int64(p.Concurrency)}, {"maxAttempts", int64(p.MaxAttempts)}, {"maxRequests", int64(p.MaxRequests)}} {
		value, err := config.Number(fmt.Sprint(budget.value))
		if err != nil {
			return nil, err
		}
		fields = append(fields, config.FieldOf(budget.name, value))
	}
	source := config.Object{config.FieldOf("connectTimeout", config.String(p.Source.ConnectTimeout.String())), config.FieldOf("idleTimeout", config.String(p.Source.IdleTimeout.String()))}
	for _, budget := range []struct {
		name  string
		value int64
	}{{"headerBytes", p.Source.HeaderBytes}, {"redirects", int64(p.Source.Redirects)}, {"dnsAddresses", int64(p.Source.DNSAddresses)}} {
		value, err := config.Number(fmt.Sprint(budget.value))
		if err != nil {
			return nil, err
		}
		source = append(source, config.FieldOf(budget.name, value))
	}
	networks := make([]config.Value, len(p.Source.AllowedNetworks))
	for index, value := range p.Source.AllowedNetworks {
		networks[index] = config.String(value)
	}
	source = append(source, config.FieldOf("allowedNetworks", config.List(networks...)))
	return append(fields, config.FieldOf("source", config.ObjectValue(source))), nil
}
