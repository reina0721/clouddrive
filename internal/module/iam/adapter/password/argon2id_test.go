package password

import (
	"encoding/base64"
	"fmt"
	"strings"
	"testing"

	"golang.org/x/crypto/argon2"
)

func TestHashVerifyAndNeedsRehash(t *testing.T) {
	const value = "correct horse battery staple"
	encoded, err := Hash(value)
	if err != nil {
		t.Fatalf("Hash() error = %v", err)
	}
	verification, err := Verify(encoded, value)
	if err != nil || !verification.Match || verification.NeedsRehash {
		t.Fatalf("Verify(current) = %#v, %v", verification, err)
	}
	verification, err = Verify(encoded, "wrong password")
	if err != nil || verification.Match || verification.NeedsRehash {
		t.Fatalf("Verify(mismatch) = %#v, %v", verification, err)
	}

	legacy := encodeTestHash(value, 32*1024, 2, 1, 16, 32)
	verification, err = Verify(legacy, value)
	if err != nil || !verification.Match || !verification.NeedsRehash {
		t.Fatalf("Verify(legacy) = %#v, %v", verification, err)
	}
}

func TestVerifyRejectsMalformedOrUnboundedPHC(t *testing.T) {
	validSalt := base64.RawStdEncoding.EncodeToString(make([]byte, targetSaltLength))
	validDigest := base64.RawStdEncoding.EncodeToString(make([]byte, targetKeyLength))
	valid := func(parameters, salt, digest string) string {
		return fmt.Sprintf("$argon2id$v=%d$%s$%s$%s", argon2.Version, parameters, salt, digest)
	}
	tests := map[string]string{
		"empty":                     "",
		"too long":                  strings.Repeat("x", maxEncodedLength+1),
		"wrong variant":             strings.Replace(valid("m=65536,t=3,p=2", validSalt, validDigest), "argon2id", "argon2i", 1),
		"wrong version":             strings.Replace(valid("m=65536,t=3,p=2", validSalt, validDigest), "v=19", "v=16", 1),
		"parameter order":           valid("t=3,m=65536,p=2", validSalt, validDigest),
		"parameter suffix":          valid("m=65536x,t=3,p=2", validSalt, validDigest),
		"parameter plus sign":       valid("m=+65536,t=3,p=2", validSalt, validDigest),
		"parameter leading zero":    valid("m=065536,t=3,p=2", validSalt, validDigest),
		"memory below budget":       valid("m=19455,t=3,p=2", validSalt, validDigest),
		"memory above budget":       valid("m=65537,t=3,p=2", validSalt, validDigest),
		"memory integer upper edge": valid("m=4294967295,t=3,p=2", validSalt, validDigest),
		"zero iterations":           valid("m=65536,t=0,p=2", validSalt, validDigest),
		"iterations below budget":   valid("m=65536,t=1,p=2", validSalt, validDigest),
		"iterations above budget":   valid("m=65536,t=4,p=2", validSalt, validDigest),
		"zero parallelism":          valid("m=65536,t=3,p=0", validSalt, validDigest),
		"parallelism above budget":  valid("m=65536,t=3,p=5", validSalt, validDigest),
		"invalid salt":              valid("m=65536,t=3,p=2", "***", validDigest),
		"short salt":                valid("m=65536,t=3,p=2", base64.RawStdEncoding.EncodeToString(make([]byte, minSaltLength-1)), validDigest),
		"long salt":                 valid("m=65536,t=3,p=2", base64.RawStdEncoding.EncodeToString(make([]byte, maxSaltLength+1)), validDigest),
		"invalid digest":            valid("m=65536,t=3,p=2", validSalt, "***"),
		"short digest":              valid("m=65536,t=3,p=2", validSalt, base64.RawStdEncoding.EncodeToString(make([]byte, minKeyLength-1))),
		"long digest":               valid("m=65536,t=3,p=2", validSalt, base64.RawStdEncoding.EncodeToString(make([]byte, maxKeyLength+1))),
	}
	for name, encoded := range tests {
		t.Run(name, func(t *testing.T) {
			if verification, err := Verify(encoded, "password"); err == nil || verification.Match || verification.NeedsRehash {
				t.Fatalf("Verify() = %#v, %v", verification, err)
			}
		})
	}
}

func encodeTestHash(value string, memoryKiB, iterations uint32, parallelism uint8, saltLength int, keyLength uint32) string {
	salt := make([]byte, saltLength)
	for index := range salt {
		salt[index] = byte(index + 1)
	}
	digest := argon2.IDKey([]byte(value), salt, iterations, memoryKiB, parallelism, keyLength)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s", argon2.Version, memoryKiB, iterations, parallelism, base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(digest))
}

func BenchmarkHash(b *testing.B) {
	for range b.N {
		if _, err := Hash("benchmark-password-value"); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkVerify(b *testing.B) {
	encoded, err := Hash("benchmark-password-value")
	if err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for range b.N {
		verification, err := Verify(encoded, "benchmark-password-value")
		if err != nil || !verification.Match {
			b.Fatalf("Verify() = %#v, %v", verification, err)
		}
	}
}
