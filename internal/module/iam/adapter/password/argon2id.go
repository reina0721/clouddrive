// Package password 封装 IAM 本地凭据使用的 Argon2id。
package password

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/iam/service"
	"golang.org/x/crypto/argon2"
)

const (
	targetMemoryKiB   uint32 = 64 * 1024
	targetIterations  uint32 = 3
	targetParallelism uint8  = 2
	targetSaltLength         = 16
	targetKeyLength   uint32 = 32

	maxEncodedLength = 512
	minMemoryKiB     = 19 * 1024
	maxMemoryKiB     = targetMemoryKiB
	minIterations    = 2
	maxIterations    = targetIterations
	maxParallelism   = 4
	minSaltLength    = 16
	maxSaltLength    = 64
	minKeyLength     = 16
	maxKeyLength     = 64
)

var errInvalidHash = errors.New("password hash is invalid")

type parameters struct {
	memoryKiB   uint32
	iterations  uint32
	parallelism uint8
	saltLength  int
	keyLength   uint32
}

// Hasher 是 IAM Service 使用的项目内密码能力适配器。
type Hasher struct{}

func (Hasher) Hash(value string) (string, error) { return Hash(value) }
func (Hasher) Verify(encoded, value string) (service.PasswordVerification, error) {
	return Verify(encoded, value)
}

func Hash(value string) (string, error) {
	salt := make([]byte, targetSaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate password salt: %w", err)
	}
	digest := argon2.IDKey([]byte(value), salt, targetIterations, targetMemoryKiB, targetParallelism, targetKeyLength)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s", argon2.Version, targetMemoryKiB, targetIterations, targetParallelism, base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(digest)), nil
}

// Verify 在执行 Argon2id 前严格限制 PHC 参数，避免损坏记录触发无界资源消耗。
func Verify(encoded, value string) (service.PasswordVerification, error) {
	parsed, salt, expected, err := parse(encoded)
	if err != nil {
		return service.PasswordVerification{}, err
	}
	actual := argon2.IDKey([]byte(value), salt, parsed.iterations, parsed.memoryKiB, parsed.parallelism, parsed.keyLength)
	matched := subtle.ConstantTimeCompare(actual, expected) == 1
	needsRehash := matched && (parsed.memoryKiB != targetMemoryKiB ||
		parsed.iterations != targetIterations ||
		parsed.parallelism != targetParallelism ||
		parsed.saltLength != targetSaltLength ||
		parsed.keyLength != targetKeyLength)
	return service.PasswordVerification{Match: matched, NeedsRehash: needsRehash}, nil
}

func parse(encoded string) (parameters, []byte, []byte, error) {
	if len(encoded) == 0 || len(encoded) > maxEncodedLength {
		return parameters{}, nil, nil, invalidHash("encoded length is outside the accepted range")
	}
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "" || parts[1] != "argon2id" || parts[2] != "v="+strconv.Itoa(argon2.Version) {
		return parameters{}, nil, nil, invalidHash("PHC prefix or version is unsupported")
	}
	encodedParameters := strings.Split(parts[3], ",")
	if len(encodedParameters) != 3 {
		return parameters{}, nil, nil, invalidHash("Argon2id parameter set is malformed")
	}
	memoryValue, err := parseParameter(encodedParameters[0], "m", 32)
	if err != nil {
		return parameters{}, nil, nil, err
	}
	iterationValue, err := parseParameter(encodedParameters[1], "t", 32)
	if err != nil {
		return parameters{}, nil, nil, err
	}
	parallelismValue, err := parseParameter(encodedParameters[2], "p", 8)
	if err != nil {
		return parameters{}, nil, nil, err
	}
	parsed := parameters{memoryKiB: uint32(memoryValue), iterations: uint32(iterationValue), parallelism: uint8(parallelismValue)}
	if parsed.memoryKiB < minMemoryKiB || parsed.memoryKiB > maxMemoryKiB ||
		parsed.iterations < minIterations || parsed.iterations > maxIterations ||
		parsed.parallelism == 0 || parsed.parallelism > maxParallelism ||
		parsed.memoryKiB < 8*uint32(parsed.parallelism) {
		return parameters{}, nil, nil, invalidHash("Argon2id resource parameters are outside the accepted budget")
	}
	salt, err := base64.RawStdEncoding.Strict().DecodeString(parts[4])
	if err != nil || len(salt) < minSaltLength || len(salt) > maxSaltLength {
		return parameters{}, nil, nil, invalidHash("salt is malformed or outside the accepted range")
	}
	expected, err := base64.RawStdEncoding.Strict().DecodeString(parts[5])
	if err != nil || len(expected) < minKeyLength || len(expected) > maxKeyLength {
		return parameters{}, nil, nil, invalidHash("digest is malformed or outside the accepted range")
	}
	parsed.saltLength = len(salt)
	parsed.keyLength = uint32(len(expected))
	return parsed, salt, expected, nil
}

func parseParameter(encoded, name string, bits int) (uint64, error) {
	prefix := name + "="
	if !strings.HasPrefix(encoded, prefix) || len(encoded) == len(prefix) {
		return 0, invalidHash("Argon2id parameter name or value is malformed")
	}
	raw := encoded[len(prefix):]
	if len(raw) > 1 && raw[0] == '0' {
		return 0, invalidHash("Argon2id parameter is not a canonical decimal integer")
	}
	for index := range len(raw) {
		if raw[index] < '0' || raw[index] > '9' {
			return 0, invalidHash("Argon2id parameter is not a canonical decimal integer")
		}
	}
	value, err := strconv.ParseUint(raw, 10, bits)
	if err != nil {
		return 0, invalidHash("Argon2id parameter is not a bounded decimal integer")
	}
	return value, nil
}

func invalidHash(reason string) error {
	return fmt.Errorf("%w: %s", errInvalidHash, reason)
}
