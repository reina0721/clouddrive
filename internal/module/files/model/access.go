package model

import "github.com/reina0721/clouddrive/pkg/idgen"

const (
	MaxAudienceRules         = 32
	MaxAccessPolicyJSONBytes = 16 << 10
	// nilAudienceSubjectID 是UUID零值，不能作为持久受众主体。
	nilAudienceSubjectID = "00000000-0000-0000-0000-000000000000"
)

// AudienceRule 只引用不可变主体ID；零权限明确表示拒绝，不表示缺失。
type AudienceRule struct {
	SubjectID   string          `json:"subjectId"`
	Permissions SharePermission `json:"permissions"`
}

// AudiencePolicy 的nil默认沿用当前层能力，账号规则优先于角色规则。
type AudiencePolicy struct {
	Anonymous     *SharePermission `json:"anonymous"`
	Authenticated *SharePermission `json:"authenticated"`
	Accounts      []AudienceRule   `json:"accounts"`
	Roles         []AudienceRule   `json:"roles"`
}

// AccessPolicy 是作为共享子项时生效的独立策略，分享根由链接策略覆盖。
type AccessPolicy struct {
	Default  SharePermission `json:"default"`
	Audience AudiencePolicy  `json:"audience"`
}

// ShareViewer 由当前可信身份事实投影，不能从公开请求参数生成。
type ShareViewer struct {
	AccountID     string
	RoleIDs       []string
	Administrator bool
}

// AccessReason 标识命中的策略层，不包含其他主体的规则内容。
type AccessReason string

const (
	AccessOwner         AccessReason = "owner"
	AccessAdministrator AccessReason = "administrator"
	AccessAccount       AccessReason = "account"
	AccessRole          AccessReason = "role"
	AccessAuthenticated AccessReason = "authenticated"
	AccessAnonymous     AccessReason = "anonymous"
	AccessDefault       AccessReason = "default"
)

// AccessDecision 只描述结果和来源，不携带其他账号的受众规则。
type AccessDecision struct {
	Permissions   SharePermission
	Reason        AccessReason
	SourceEntryID string
}

func validAudiencePermission(p SharePermission) bool { return p == 0 || p.Valid() }

// Validate 拒绝超额、重复主体和不满足能力依赖的受众策略。
func (p AudiencePolicy) Validate() error {
	if len(p.Accounts)+len(p.Roles) > MaxAudienceRules {
		return ErrTooLarge
	}
	for _, permission := range []*SharePermission{p.Anonymous, p.Authenticated} {
		if permission != nil && !validAudiencePermission(*permission) {
			return ErrInvalid
		}
	}
	for _, rules := range [][]AudienceRule{p.Accounts, p.Roles} {
		seen := make(map[string]struct{}, len(rules))
		for _, rule := range rules {
			if idgen.Validate(rule.SubjectID) != nil || rule.SubjectID == nilAudienceSubjectID || !validAudiencePermission(rule.Permissions) {
				return ErrInvalid
			}
			if _, duplicate := seen[rule.SubjectID]; duplicate {
				return ErrInvalid
			}
			seen[rule.SubjectID] = struct{}{}
		}
	}
	return nil
}

// Validate 校验独立默认能力与受众；明确拒绝允许全零。
func (p AccessPolicy) Validate() error {
	if !validAudiencePermission(p.Default) {
		return ErrInvalid
	}
	return p.Audience.Validate()
}

// CloneAudience 复制指针与规则切片，避免调用方修改已保存的策略快照。
func CloneAudience(p AudiencePolicy) AudiencePolicy {
	result := p
	if p.Anonymous != nil {
		permission := *p.Anonymous
		result.Anonymous = &permission
	}
	if p.Authenticated != nil {
		permission := *p.Authenticated
		result.Authenticated = &permission
	}
	result.Accounts = append([]AudienceRule{}, p.Accounts...)
	result.Roles = append([]AudienceRule{}, p.Roles...)
	return result
}

// CloneAccessPolicy 保持nil继承语义，并深复制独立策略。
func CloneAccessPolicy(p *AccessPolicy) *AccessPolicy {
	if p == nil {
		return nil
	}
	return &AccessPolicy{Default: p.Default, Audience: CloneAudience(p.Audience)}
}

func audienceDecision(base SharePermission, p AudiencePolicy, viewer ShareViewer) (SharePermission, AccessReason) {
	if viewer.AccountID != "" {
		for _, rule := range p.Accounts {
			if rule.SubjectID == viewer.AccountID {
				return rule.Permissions, AccessAccount
			}
		}
		matched := false
		var merged SharePermission
		for _, rule := range p.Roles {
			for _, role := range viewer.RoleIDs {
				if role != rule.SubjectID {
					continue
				}
				if rule.Permissions == 0 {
					return 0, AccessRole
				}
				matched = true
				merged |= rule.Permissions
				break
			}
		}
		if matched {
			return merged, AccessRole
		}
		if p.Authenticated != nil {
			return *p.Authenticated, AccessAuthenticated
		}
	} else if p.Anonymous != nil {
		return *p.Anonymous, AccessAnonymous
	}
	return base, AccessDefault
}

// EffectiveAccess 在有界文件树中只寻找最近独立策略；根本身的文件策略不生效。
func EffectiveAccess(entries []Entry, share Share, target string, viewer ShareViewer) (AccessDecision, error) {
	resolver, err := NewShareAccessResolver(entries, share, viewer)
	if err != nil {
		return AccessDecision{}, err
	}
	return resolver.Decision(target)
}
