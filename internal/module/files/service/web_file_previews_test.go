package service

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/clock"
)

func TestWebPreviewRejectsExpiredAuthenticatedGrant(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	block, err := aes.NewCipher(make([]byte, 32))
	if err != nil {
		t.Fatal(err)
	}
	sealer, err := cipher.NewGCMWithRandomNonce(block)
	if err != nil {
		t.Fatal(err)
	}
	service := WebFilePreviews{files: &Service{clock: clock.Fixed(now)}, sealer: sealer}
	encoded, err := json.Marshal(webPreviewGrant{ExpiresAt: now.Unix()})
	if err != nil {
		t.Fatal(err)
	}
	sealed := sealer.Seal(nil, nil, encoded, nil)
	use := func(model.Entry, io.ReadSeeker, string) error {
		t.Fatal("到期或篡改的授权不得访问文件")
		return nil
	}
	for range 2 {
		token := base64.RawURLEncoding.EncodeToString(sealed)
		if err := service.DownloadTo(t.Context(), token, use); !errors.Is(err, model.ErrMissing) {
			t.Fatalf("授权错误 = %v", err)
		}
		sealed[0] ^= 1
	}
}
