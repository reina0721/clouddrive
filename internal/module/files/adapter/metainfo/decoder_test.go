package metainfo

import (
	"bytes"
	"crypto/sha1"
	"encoding/base32"
	"encoding/hex"
	"errors"
	"strings"
	"testing"

	"github.com/anacrolix/torrent/bencode"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

func encodedMetadata(t *testing.T, paths ...[]string) ([]byte, []byte) {
	t.Helper()
	files := make([]any, 0, len(paths))
	for _, path := range paths {
		files = append(files, map[string]any{"length": int64(4), "path": path})
	}
	info, err := bencode.Marshal(map[string]any{"name": "bundle", "files": files, "piece length": int64(16384), "pieces": strings.Repeat("a", 20)})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := bencode.Marshal(map[string]any{"announce": "https://tracker.example/announce", "info": bencode.Bytes(info)})
	if err != nil {
		t.Fatal(err)
	}
	return raw, info
}

func TestDecodePreservesOriginalInfoHashAndRealManifest(t *testing.T) {
	raw, info := encodedMetadata(t, []string{"文档", "readme.txt"}, []string{"video.bin"})
	metadata, err := (Decoder{}).Decode(raw)
	if err != nil {
		t.Fatal(err)
	}
	digest := sha1.Sum(info)
	if metadata.InfoHash != hex.EncodeToString(digest[:]) || metadata.TotalBytes != 8 || len(metadata.Files) != 2 || metadata.Files[0].Index != 1 || metadata.Files[0].Path != "bundle/文档/readme.txt" || metadata.Files[1].SizeBytes != 4 {
		t.Fatalf("元数据摘要或真实清单不匹配: %+v", metadata)
	}
}

func TestDecodeRejectsUnsafeAndAmbiguousPaths(t *testing.T) {
	for name, paths := range map[string][][]string{
		"穿越": {{"..", "escape"}}, "绝对路径": {{"/escape"}}, "Windows分隔符": {{`a\b`}},
		"设备名": {{"COM¹.txt"}}, "尾随点": {{"a."}}, "冒号": {{"a:stream"}},
		"大小写重名": {{"a.txt"}, {"A.txt"}}, "文件目录冲突": {{"a"}, {"a", "b"}},
		"目录大小写冲突": {{"a", "one"}, {"A", "two"}}, "非规范Unicode": {{"e\u0301.txt"}},
	} {
		t.Run(name, func(t *testing.T) {
			raw, _ := encodedMetadata(t, paths...)
			if _, err := (Decoder{}).Decode(raw); !errors.Is(err, service.ErrTorrentMetadata) {
				t.Fatalf("不安全路径未拒绝: %v", err)
			}
		})
	}
}

func TestDecodeBoundsSyntaxAndRejectsDuplicateKeys(t *testing.T) {
	raw, _ := encodedMetadata(t, []string{"safe"})
	for name, payload := range map[string][]byte{
		"尾随内容":    append(bytes.Clone(raw), 'e'),
		"重复键":     []byte("d4:infod4:name1:a4:name1:bee"),
		"过深嵌套":    []byte(strings.Repeat("l", 64) + strings.Repeat("e", 64)),
		"超大字符串声明": []byte("d4:info999999999999999999999:"),
		"超过原始预算":  bytes.Repeat([]byte("a"), service.MaxTorrentMetadataBytes+1),
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := (Decoder{}).Decode(payload); !errors.Is(err, service.ErrTorrentMetadata) {
				t.Fatalf("畸形元数据未受控拒绝: %v", err)
			}
		})
	}
}

func TestMagnetNormalizesV1AndRejectsPathOrProtocolInjection(t *testing.T) {
	digest := sha1.Sum([]byte("magnet-fixture"))
	hexHash := hex.EncodeToString(digest[:])
	base32Hash := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(digest[:])
	for _, hash := range []string{strings.ToUpper(hexHash), base32Hash} {
		normalized, actual, err := (Decoder{}).NormalizeMagnet("magnet:?xt=urn:btih:" + hash + "&dn=safe&tr=https%3A%2F%2Ftracker.example%2Fannounce")
		if err != nil || actual != hexHash || !strings.Contains(normalized, hexHash) {
			t.Fatalf("v1磁力规范化失败: %v", err)
		}
	}
	for _, source := range []string{
		"magnet:?xt=urn:btmh:1220" + strings.Repeat("a", 64),
		"magnet:?xt=urn:btih:" + hexHash + "&xt=urn:btih:" + hexHash,
		"magnet:?xt=urn:btih:" + hexHash + "&dir=C%3A%2Fescape",
		"magnet:?xt=urn:btih:" + hexHash + "&dn=..",
		"magnet:?xt=urn:btih:" + hexHash + "&tr=file%3A%2F%2F%2Fsecret",
	} {
		if _, _, err := (Decoder{}).NormalizeMagnet(source); !errors.Is(err, service.ErrTorrentMetadata) && !errors.Is(err, service.ErrTorrentUnsupported) {
			t.Fatalf("非法磁力未拒绝: %v", err)
		}
	}
}
