package service

import (
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"net/netip"
	"time"
)

const (
	DefaultDownloadConcurrency            = 1
	MaxDownloadConcurrency                = 2
	DefaultDownloadInterval               = time.Second
	DefaultDownloadLeaseTTL               = 20 * time.Second
	DefaultDownloadRenewInterval          = 5 * time.Second
	DefaultDownloadProgressInterval       = time.Second
	DefaultDownloadAttemptTimeout         = 15 * time.Minute
	DefaultDownloadMaxRequests            = 64
	DefaultDownloadSourceTimeout          = 10 * time.Second
	DefaultDownloadIdleTimeout            = 15 * time.Second
	DefaultDownloadHeaderBytes      int64 = 32 << 10
	DefaultDownloadRedirects              = 5
	DefaultDownloadDNSAddresses           = 16
	MaxDownloadAllowedNetworks            = 16
	DefaultDownloadPageSize               = 20
)

// DownloadSourcePolicy 只治理来源连接，应用Cookie、环境代理和任意Header不属于该能力。
type DownloadSourcePolicy struct {
	ConnectTimeout  time.Duration `mapstructure:"connectTimeout"`
	IdleTimeout     time.Duration `mapstructure:"idleTimeout"`
	HeaderBytes     int64         `mapstructure:"headerBytes"`
	Redirects       int           `mapstructure:"redirects"`
	DNSAddresses    int           `mapstructure:"dnsAddresses"`
	AllowedNetworks []string      `mapstructure:"allowedNetworks"`
}

type DownloadPolicy struct {
	TorrentNodes             []TorrentNodeConfig  `mapstructure:"torrentNodes"`
	TorrentNodeConcurrency   int                  `mapstructure:"torrentNodeConcurrency"`
	TorrentNodeReservedBytes int64                `mapstructure:"torrentNodeReservedBytes"`
	Enabled                  bool                 `mapstructure:"enabled"`
	BatchEntries             int                  `mapstructure:"batchEntries"`
	OwnerRecords             int                  `mapstructure:"ownerRecords"`
	GlobalRecords            int                  `mapstructure:"globalRecords"`
	Concurrency              int                  `mapstructure:"concurrency"`
	DispatchInterval         time.Duration        `mapstructure:"dispatchInterval"`
	LeaseTTL                 time.Duration        `mapstructure:"leaseTTL"`
	RenewInterval            time.Duration        `mapstructure:"renewInterval"`
	ProgressInterval         time.Duration        `mapstructure:"progressInterval"`
	AttemptTimeout           time.Duration        `mapstructure:"attemptTimeout"`
	MaxAttempts              int                  `mapstructure:"maxAttempts"`
	MaxRequests              int                  `mapstructure:"maxRequests"`
	Source                   DownloadSourcePolicy `mapstructure:"source"`
}

// DefaultDownloadPolicy 集中声明业务、租约和网络预算，binding不复制第二套默认值。
func DefaultDownloadPolicy() DownloadPolicy {
	return DownloadPolicy{TorrentNodes: []TorrentNodeConfig{}, TorrentNodeConcurrency: DefaultTorrentNodeConcurrency, TorrentNodeReservedBytes: DefaultTorrentNodeReservedBytes, Enabled: true, BatchEntries: model.MaxDownloadBatchEntries, OwnerRecords: model.MaxDownloadOwnerRecords, GlobalRecords: model.MaxDownloadGlobalRecords, Concurrency: DefaultDownloadConcurrency, DispatchInterval: DefaultDownloadInterval, LeaseTTL: DefaultDownloadLeaseTTL, RenewInterval: DefaultDownloadRenewInterval, ProgressInterval: DefaultDownloadProgressInterval, AttemptTimeout: DefaultDownloadAttemptTimeout, MaxAttempts: model.MaxDownloadAttempts, MaxRequests: DefaultDownloadMaxRequests, Source: DownloadSourcePolicy{ConnectTimeout: DefaultDownloadSourceTimeout, IdleTimeout: DefaultDownloadIdleTimeout, HeaderBytes: DefaultDownloadHeaderBytes, Redirects: DefaultDownloadRedirects, DNSAddresses: DefaultDownloadDNSAddresses, AllowedNetworks: []string{}}}
}
func (p DownloadSourcePolicy) Validate() error {
	if p.ConnectTimeout <= 0 || p.ConnectTimeout > DefaultDownloadSourceTimeout || p.IdleTimeout <= 0 || p.IdleTimeout > DefaultDownloadIdleTimeout || p.HeaderBytes < 1 || p.HeaderBytes > DefaultDownloadHeaderBytes || p.Redirects < 0 || p.Redirects > DefaultDownloadRedirects || p.DNSAddresses < 1 || p.DNSAddresses > DefaultDownloadDNSAddresses || len(p.AllowedNetworks) > MaxDownloadAllowedNetworks {
		return fmt.Errorf("invalid offline source budget")
	}
	for _, raw := range p.AllowedNetworks {
		prefix, err := netip.ParsePrefix(raw)
		if err != nil || prefix != prefix.Masked() || (prefix.Addr().Is4() && prefix.Bits() < 8) || (prefix.Addr().Is6() && prefix.Bits() < 32) || prefix.Addr().IsUnspecified() || prefix.Addr().IsMulticast() {
			return fmt.Errorf("invalid offline allowed network")
		}
	}
	return nil
}
func (p DownloadPolicy) Validate() error {
	if err := p.validateTorrentNodes(); err != nil {
		return err
	}
	if p.BatchEntries < 1 || p.BatchEntries > model.MaxDownloadBatchEntries || p.OwnerRecords < 1 || p.OwnerRecords > model.MaxDownloadOwnerRecords || p.GlobalRecords < p.OwnerRecords || p.GlobalRecords > model.MaxDownloadGlobalRecords || p.Concurrency < 1 || p.Concurrency > MaxDownloadConcurrency || p.MaxAttempts < 1 || p.MaxAttempts > model.MaxDownloadAttempts || p.MaxRequests < 1 || p.MaxRequests > DefaultDownloadMaxRequests {
		return fmt.Errorf("invalid offline task budget")
	}
	if p.DispatchInterval <= 0 || p.DispatchInterval > DefaultDownloadInterval || p.LeaseTTL <= 0 || p.LeaseTTL > DefaultDownloadLeaseTTL || p.RenewInterval <= 0 || p.RenewInterval*3 > p.LeaseTTL || p.ProgressInterval <= 0 || p.ProgressInterval > DefaultDownloadProgressInterval || p.AttemptTimeout <= 0 || p.AttemptTimeout > DefaultDownloadAttemptTimeout {
		return fmt.Errorf("invalid offline time budget")
	}
	return p.Source.Validate()
}
