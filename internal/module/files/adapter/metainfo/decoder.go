// Package metainfo 隔离成熟bencode解码器及项目允许的BT v1元数据子集。
package metainfo

import (
	"bytes"
	"crypto/sha1"
	"encoding/base32"
	"encoding/hex"
	"fmt"
	"net/url"
	"path"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/anacrolix/torrent/bencode"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"golang.org/x/text/unicode/norm"
)

const (
	maxDepth        = 32
	minPieceBytes   = 16 << 10
	maxPieceBytes   = 16 << 20
	pieceDigestSize = sha1.Size
	maxTrackers     = 50
)

type Decoder struct{}

var _ service.TorrentMetadataDecoder = Decoder{}

// decodeSingle 不接受尾随字节，明确限制字符串和容器深度。
func decodeSingle(raw []byte, target any) error {
	decoder := bencode.NewDecoder(bytes.NewReader(raw))
	decoder.MaxStrLen = service.MaxTorrentMetadataBytes
	decoder.MaxDepth = maxDepth
	if err := decoder.Decode(target); err != nil {
		return &service.TorrentError{Kind: service.ErrTorrentMetadata, Cause: err}
	}
	if decoder.Offset != int64(len(raw)) {
		return service.ErrTorrentMetadata
	}
	return nil
}

type torrentDocument struct {
	Info bencode.Bytes `bencode:"info"`
}

type infoDocument struct {
	Name        string          `bencode:"name"`
	UTF8Name    string          `bencode:"name.utf-8"`
	Length      *int64          `bencode:"length"`
	Files       *[]fileDocument `bencode:"files"`
	PieceLength int64           `bencode:"piece length"`
	Pieces      string          `bencode:"pieces"`
	MetaVersion *int64          `bencode:"meta version"`
	Attr        string          `bencode:"attr"`
	SymlinkPath []string        `bencode:"symlink path"`
}

type fileDocument struct {
	Length      *int64   `bencode:"length"`
	Path        []string `bencode:"path"`
	UTF8Path    []string `bencode:"path.utf-8"`
	Attr        string   `bencode:"attr"`
	SymlinkPath []string `bencode:"symlink path"`
}

func validSegment(segment string) bool {
	if model.ValidateName(segment) != nil || !norm.NFC.IsNormalString(segment) || strings.HasSuffix(segment, ".") || strings.ContainsAny(segment, ":*?\"<>|") {
		return false
	}
	stem := strings.ToUpper(strings.SplitN(segment, ".", 2)[0])
	switch stem {
	case "CON", "PRN", "AUX", "NUL", "CLOCK$", "CONIN$", "CONOUT$":
		return false
	}
	if runes := []rune(stem); len(runes) == 4 && (strings.HasPrefix(stem, "COM") || strings.HasPrefix(stem, "LPT")) && strings.ContainsRune("123456789¹²³", runes[3]) {
		return false
	}
	return true
}

// Decode 先用同一成熟解码器校验规范编码，再从原始info字节计算摘要。
// 规范化比较用于拒绝重复键和歧义编码，绝不拿重新编码的字节冒充infohash。
func (Decoder) Decode(raw []byte) (service.TorrentMetadata, error) {
	if len(raw) == 0 || len(raw) > service.MaxTorrentMetadataBytes {
		return service.TorrentMetadata{}, service.ErrTorrentMetadata
	}
	var syntax any
	if err := decodeSingle(raw, &syntax); err != nil {
		return service.TorrentMetadata{}, err
	}
	canonical, err := bencode.Marshal(syntax)
	if err != nil {
		return service.TorrentMetadata{}, &service.TorrentError{Kind: service.ErrTorrentMetadata, Cause: err}
	}
	if !bytes.Equal(canonical, raw) {
		return service.TorrentMetadata{}, service.ErrTorrentMetadata
	}
	var document torrentDocument
	if err := decodeSingle(raw, &document); err != nil {
		return service.TorrentMetadata{}, err
	}
	var info infoDocument
	if err := decodeSingle(document.Info, &info); err != nil {
		return service.TorrentMetadata{}, err
	}
	if info.MetaVersion != nil || strings.ContainsAny(info.Attr, "lp") || len(info.SymlinkPath) != 0 {
		return service.TorrentMetadata{}, service.ErrTorrentUnsupported
	}
	if !validSegment(info.Name) || (info.UTF8Name != "" && info.UTF8Name != info.Name) || info.PieceLength < minPieceBytes || info.PieceLength > maxPieceBytes || info.PieceLength&(info.PieceLength-1) != 0 {
		return service.TorrentMetadata{}, service.ErrTorrentMetadata
	}
	digest := sha1.Sum(document.Info)
	result := service.TorrentMetadata{InfoHash: hex.EncodeToString(digest[:]), Name: info.Name, Files: []service.TorrentFile{}}
	if info.Files == nil {
		if info.Length == nil || *info.Length < 0 || *info.Length > model.MaxFileContentBytes {
			return service.TorrentMetadata{}, service.ErrTorrentMetadata
		}
		result.TotalBytes = *info.Length
		result.Files = append(result.Files, service.TorrentFile{Index: 1, Path: info.Name, SizeBytes: *info.Length})
	} else {
		if info.Length != nil || len(*info.Files) == 0 || len(*info.Files) > service.MaxTorrentFiles {
			return service.TorrentMetadata{}, service.ErrTorrentMetadata
		}
		files := map[string]bool{}
		directories := map[string]string{}
		for index, file := range *info.Files {
			if file.Length == nil || *file.Length < 0 || *file.Length > model.MaxFileContentBytes-result.TotalBytes || len(file.Path) == 0 || len(file.Path)+1 > service.MaxTorrentPathSegments || strings.ContainsAny(file.Attr, "lp") || len(file.SymlinkPath) != 0 {
				return service.TorrentMetadata{}, service.ErrTorrentMetadata
			}
			if len(file.UTF8Path) != 0 && !sameSegments(file.Path, file.UTF8Path) {
				return service.TorrentMetadata{}, service.ErrTorrentMetadata
			}
			for _, segment := range file.Path {
				if !validSegment(segment) {
					return service.TorrentMetadata{}, service.ErrTorrentMetadata
				}
			}
			name := info.Name + "/" + strings.Join(file.Path, "/")
			folded := strings.ToLower(name)
			if len(name) > service.MaxTorrentPathBytes || files[folded] || directories[folded] != "" {
				return service.TorrentMetadata{}, service.ErrTorrentMetadata
			}
			for parent := path.Dir(name); parent != "."; parent = path.Dir(parent) {
				key := strings.ToLower(parent)
				if files[key] || (directories[key] != "" && directories[key] != parent) {
					return service.TorrentMetadata{}, service.ErrTorrentMetadata
				}
				directories[key] = parent
			}
			files[folded] = true
			result.TotalBytes += *file.Length
			result.Files = append(result.Files, service.TorrentFile{Index: index + 1, Path: name, SizeBytes: *file.Length})
		}
	}
	pieces := (result.TotalBytes + info.PieceLength - 1) / info.PieceLength
	if int64(len(info.Pieces)) != pieces*pieceDigestSize {
		return service.TorrentMetadata{}, service.ErrTorrentMetadata
	}
	return result, nil
}

func sameSegments(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

func validTracker(raw string) bool {
	parsed, err := url.Parse(raw)
	return err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https" || parsed.Scheme == "udp") && parsed.Hostname() != "" && parsed.User == nil && parsed.Fragment == "" && parsed.Opaque == ""
}

func (Decoder) NormalizeMagnet(raw string) (string, string, error) {
	if len(raw) == 0 || len(raw) > model.MaxDownloadURLBytes || !utf8.ValidString(raw) || strings.IndexFunc(raw, func(r rune) bool { return unicode.IsControl(r) || unicode.IsSpace(r) }) >= 0 {
		return "", "", service.ErrTorrentMetadata
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "magnet" || parsed.Host != "" || parsed.Path != "" || parsed.Opaque != "" || parsed.User != nil || parsed.Fragment != "" {
		return "", "", service.ErrTorrentMetadata
	}
	query, err := url.ParseQuery(parsed.RawQuery)
	if err != nil || len(query["xt"]) != 1 || !strings.HasPrefix(query.Get("xt"), "urn:btih:") || len(query["tr"]) > maxTrackers || len(query["dn"]) > 1 {
		return "", "", service.ErrTorrentMetadata
	}
	for key := range query {
		if key != "xt" && key != "tr" && key != "dn" {
			return "", "", service.ErrTorrentUnsupported
		}
	}
	hash := strings.TrimPrefix(query.Get("xt"), "urn:btih:")
	var digest []byte
	switch len(hash) {
	case sha1.Size * 2:
		digest, err = hex.DecodeString(hash)
	case 32:
		digest, err = base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(hash))
	default:
		return "", "", service.ErrTorrentMetadata
	}
	if err != nil || len(digest) != sha1.Size {
		return "", "", service.ErrTorrentMetadata
	}
	for _, tracker := range query["tr"] {
		if !validTracker(tracker) {
			return "", "", service.ErrTorrentMetadata
		}
	}
	if name := query.Get("dn"); name != "" && !validSegment(name) {
		return "", "", service.ErrTorrentMetadata
	}
	hash = hex.EncodeToString(digest)
	query.Set("xt", "urn:btih:"+hash)
	parsed.RawQuery = query.Encode()
	if len(parsed.String()) > model.MaxDownloadURLBytes {
		return "", "", fmt.Errorf("normalize torrent magnet: %w", service.ErrTorrentMetadata)
	}
	return parsed.String(), hash, nil
}
