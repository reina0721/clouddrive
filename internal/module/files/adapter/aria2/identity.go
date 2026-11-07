package aria2

import (
	"context"
	"encoding/hex"
	"path/filepath"

	"github.com/reina0721/clouddrive/internal/module/files/service"
)

// 新版本需要刷新协议证据后再接纳；不能仅凭版本字符串更大就假定兼容。
const supportedEngineVersion = "1.37.0"

func (c *Client) Probe(ctx context.Context) (service.TorrentNodeIdentity, error) {
	var version struct {
		Version  string   `json:"version"`
		Features []string `json:"enabledFeatures"`
	}
	if err := c.call(ctx, "aria2.getVersion", &version); err != nil {
		return service.TorrentNodeIdentity{}, err
	}
	if version.Version != supportedEngineVersion {
		return service.TorrentNodeIdentity{}, service.ErrTorrentUnsupported
	}
	features := map[string]bool{}
	for _, feature := range version.Features {
		features[feature] = true
	}
	if !features["BitTorrent"] || !features["HTTPS"] {
		return service.TorrentNodeIdentity{}, service.ErrTorrentUnsupported
	}
	var options struct {
		SaveSession      string `json:"save-session"`
		DeferredInput    string `json:"deferred-input"`
		CheckCertificate string `json:"check-certificate"`
	}
	if err := c.call(ctx, "aria2.getGlobalOption", &options); err != nil {
		return service.TorrentNodeIdentity{}, err
	}
	if !filepath.IsAbs(options.SaveSession) || options.DeferredInput != "false" || options.CheckCertificate != "true" {
		return service.TorrentNodeIdentity{}, service.ErrTorrentUnsupported
	}
	var session struct {
		ID string `json:"sessionId"`
	}
	if err := c.call(ctx, "aria2.getSessionInfo", &session); err != nil {
		return service.TorrentNodeIdentity{}, err
	}
	decoded, err := hex.DecodeString(session.ID)
	if err != nil || len(decoded) < rpcGIDBytes || len(decoded) > 64 {
		return service.TorrentNodeIdentity{}, service.ErrTorrentProtocol
	}
	return service.TorrentNodeIdentity{Version: version.Version, SessionID: session.ID}, nil
}

func (c *Client) PersistSession(ctx context.Context) error {
	var result string
	if err := c.call(ctx, "aria2.saveSession", &result); err != nil {
		return err
	}
	if result != "OK" {
		return service.ErrTorrentProtocol
	}
	return nil
}
