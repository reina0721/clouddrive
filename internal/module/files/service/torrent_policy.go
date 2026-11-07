package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/netip"
	"net/url"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// TorrentWorkspaceIdentity 同时绑定节点ID、RPC端点与共享挂载；名称和Secret轮换不改变位置身份。
func TorrentWorkspaceIdentity(node TorrentNodeConfig) (string, error) {
	if err := node.Validate(); err != nil {
		return "", err
	}
	root := filepath.Clean(node.WorkspaceRoot)
	if runtime.GOOS == "windows" {
		root = strings.ToLower(root)
	}
	location := struct{ ID, Endpoint, Root string }{node.ID, node.Endpoint, root}
	encoded, err := json.Marshal(location)
	if err != nil {
		return "", fmt.Errorf("encode torrent workspace identity: %w", err)
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

const (
	MaxTorrentNodes                       = 4
	DefaultTorrentNodeConcurrency         = 1
	DefaultTorrentNodeReservedBytes int64 = 2 << 30
	MaxTorrentNodeReservedBytes     int64 = 8 << 30
)

// TorrentNodeConfig 只由管理员配置注入，Secret和挂载目录不进入产品契约。
type TorrentNodeConfig struct {
	ID            string `mapstructure:"id"`
	Name          string `mapstructure:"name"`
	Endpoint      string `mapstructure:"endpoint"`
	Secret        string `mapstructure:"secret"`
	WorkspaceRoot string `mapstructure:"workspaceRoot"`
}

// Validate 校验节点的受控配置，不进行DNS、文件系统或RPC I/O。
func (node TorrentNodeConfig) Validate() error {
	if node.ID == "" || len(node.ID) > model.MaxDownloadClientKeyBytes || model.ValidateName(node.Name) != nil || node.Secret == "" || len(node.Secret) > model.MaxDownloadURLBytes || !filepath.IsAbs(node.WorkspaceRoot) || len(node.WorkspaceRoot) > MaxTorrentPathBytes {
		return fmt.Errorf("invalid torrent node configuration")
	}
	for _, character := range node.ID {
		if character != '-' && character != '_' && !(character >= 'a' && character <= 'z') && !(character >= '0' && character <= '9') {
			return fmt.Errorf("invalid torrent node identity")
		}
	}
	endpoint, err := url.Parse(node.Endpoint)
	if err != nil {
		return &TorrentError{Kind: ErrTorrentNode, Cause: err}
	}
	if endpoint.Hostname() == "" || endpoint.User != nil || endpoint.RawQuery != "" || endpoint.ForceQuery || endpoint.Fragment != "" || endpoint.Opaque != "" || strings.Contains(endpoint.Hostname(), "%") || len(node.Endpoint) > model.MaxDownloadURLBytes {
		return fmt.Errorf("invalid torrent RPC endpoint")
	}
	if endpoint.Scheme != "https" {
		address, err := netip.ParseAddr(endpoint.Hostname())
		if endpoint.Scheme != "http" || err != nil || !address.IsLoopback() {
			return fmt.Errorf("torrent remote RPC requires TLS")
		}
	}
	if endpoint.Port() != "" {
		port, err := strconv.Atoi(endpoint.Port())
		if err != nil {
			return &TorrentError{Kind: ErrTorrentNode, Cause: err}
		}
		if port < 1 || port > 65535 {
			return fmt.Errorf("invalid torrent RPC port")
		}
	}
	return nil
}

func (p DownloadPolicy) validateTorrentNodes() error {
	if len(p.TorrentNodes) > MaxTorrentNodes || p.TorrentNodeConcurrency < 1 || p.TorrentNodeConcurrency > MaxDownloadConcurrency || p.TorrentNodeReservedBytes < TorrentMetadataReservationBytes || p.TorrentNodeReservedBytes > MaxTorrentNodeReservedBytes {
		return fmt.Errorf("invalid torrent node budget")
	}
	identities := map[string]bool{}
	roots := map[string]bool{}
	for _, node := range p.TorrentNodes {
		if err := node.Validate(); err != nil {
			return err
		}
		root := strings.ToLower(filepath.Clean(node.WorkspaceRoot))
		if identities[node.ID] || roots[root] {
			return fmt.Errorf("torrent identity and workspace must have one node owner")
		}
		identities[node.ID], roots[root] = true, true
	}
	return nil
}
