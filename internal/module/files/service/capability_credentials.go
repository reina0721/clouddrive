package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
)

const capabilitySecretBytes = 32

// newCapabilitySecret 只签发高熵随机凭据，不能用于替代用户密码摘要。
func newCapabilitySecret() (string, error) {
	secret := make([]byte, capabilitySecretBytes)
	if _, err := rand.Read(secret); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(secret), nil
}
func credentialDigest(domain, secret string) string {
	digest := sha256.Sum256([]byte(domain + ":" + secret))
	return hex.EncodeToString(digest[:])
}
func validSecret(secret string) bool {
	decoded, err := base64.RawURLEncoding.DecodeString(secret)
	return err == nil && len(decoded) == capabilitySecretBytes && base64.RawURLEncoding.EncodeToString(decoded) == secret
}
