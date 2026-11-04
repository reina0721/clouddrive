package iam

import passwordadapter "github.com/reina0721/clouddrive/internal/module/iam/adapter/password"

// CredentialDigests 是凭据摘要的无资源 facet，不暴露 IAM Service 或密码库类型。
type CredentialDigests interface {
	Hash(string) (string, error)
	Verify(string, string) (bool, error)
}

// NewCredentialDigests 供组合根注入需要密码摘要的使用方，不产生会话或认证主体。
func NewCredentialDigests() CredentialDigests { return credentialDigests{} }

type credentialDigests struct{}

func (credentialDigests) Hash(value string) (string, error) { return passwordadapter.Hash(value) }
func (credentialDigests) Verify(encoded, value string) (bool, error) {
	result, err := passwordadapter.Verify(encoded, value)
	return result.Match, err
}
