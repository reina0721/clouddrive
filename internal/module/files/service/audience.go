package service

import (
	"context"
	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// AudienceKind 限定本实例账号和角色两种可选主体。
type AudienceKind string

const (
	AudienceAccount AudienceKind = "account"
	AudienceRole    AudienceKind = "role"
)

// AudienceTarget 只包含精确选择所需的稳定ID与显示标签。
type AudienceTarget struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// ShareAudienceAuthority 只读取可信当前身份与精确选择事实，不取得IAM实现。
type ShareAudienceAuthority interface {
	ShareViewer(context.Context) (model.ShareViewer, error)
	AudienceAccount(context.Context, string) (model.ShareViewer, error)
	AudienceTarget(context.Context, AudienceKind, string) (AudienceTarget, error)
	FindAudienceTarget(context.Context, AudienceKind, string) (AudienceTarget, error)
}

// AudienceRule 保存主体能力；Label只供显示，不参与授权或持久化。
type AudienceRule struct {
	SubjectID   string           `json:"subjectId" minLength:"36" maxLength:"36"`
	Permissions SharePermissions `json:"permissions"`
	Label       string           `json:"label,omitempty" maxLength:"255"`
}

// ShareAudience 用可读能力投影策略；nil和显式全false分别表示沿用与拒绝。
type ShareAudience struct {
	Anonymous     *SharePermissions `json:"anonymous"`
	Authenticated *SharePermissions `json:"authenticated"`
	Accounts      []AudienceRule    `json:"accounts" maxItems:"32"`
	Roles         []AudienceRule    `json:"roles" maxItems:"32"`
}

func audienceFromModel(p model.AudiencePolicy) ShareAudience {
	result := ShareAudience{Accounts: []AudienceRule{}, Roles: []AudienceRule{}}
	if p.Anonymous != nil {
		permission := sharePermissions(*p.Anonymous)
		result.Anonymous = &permission
	}
	if p.Authenticated != nil {
		permission := sharePermissions(*p.Authenticated)
		result.Authenticated = &permission
	}
	for _, rule := range p.Accounts {
		result.Accounts = append(result.Accounts, AudienceRule{SubjectID: rule.SubjectID, Permissions: sharePermissions(rule.Permissions)})
	}
	for _, rule := range p.Roles {
		result.Roles = append(result.Roles, AudienceRule{SubjectID: rule.SubjectID, Permissions: sharePermissions(rule.Permissions)})
	}
	return result
}

func (p ShareAudience) model() model.AudiencePolicy {
	result := model.AudiencePolicy{Accounts: []model.AudienceRule{}, Roles: []model.AudienceRule{}}
	if p.Anonymous != nil {
		permission := p.Anonymous.permissionSet()
		result.Anonymous = &permission
	}
	if p.Authenticated != nil {
		permission := p.Authenticated.permissionSet()
		result.Authenticated = &permission
	}
	for _, rule := range p.Accounts {
		result.Accounts = append(result.Accounts, model.AudienceRule{SubjectID: rule.SubjectID, Permissions: rule.Permissions.permissionSet()})
	}
	for _, rule := range p.Roles {
		result.Roles = append(result.Roles, model.AudienceRule{SubjectID: rule.SubjectID, Permissions: rule.Permissions.permissionSet()})
	}
	return result
}

func (s *Sharing) validateAudienceTargets(ctx context.Context, current, previous model.AudiencePolicy) error {
	if err := current.Validate(); err != nil {
		return err
	}
	for _, group := range []struct {
		kind         AudienceKind
		rules, prior []model.AudienceRule
	}{{AudienceAccount, current.Accounts, previous.Accounts}, {AudienceRole, current.Roles, previous.Roles}} {
		for _, rule := range group.rules {
			existing := false
			for _, prior := range group.prior {
				if prior.SubjectID == rule.SubjectID {
					existing = true
					break
				}
			}
			// 保留已失效主体规则不会授予访问；修改其他设置时不强制用户删除历史规则。
			if existing {
				continue
			}
			if _, err := s.accounts.AudienceTarget(ctx, group.kind, rule.SubjectID); err != nil {
				return err
			}
		}
	}
	return nil
}

// LookupAudience 精确查找可信本实例主体，不枚举账号或角色目录。
func (s *Sharing) LookupAudience(ctx context.Context, kind AudienceKind, key string) (AudienceTarget, error) {
	if kind != AudienceAccount && kind != AudienceRole {
		return AudienceTarget{}, model.ErrInvalid
	}
	return s.accounts.FindAudienceTarget(ctx, kind, key)
}

func (s *Sharing) publicPermissions(ctx context.Context, snapshot ShareSnapshot, id string) (SharePermissions, error) {
	viewer, err := s.accounts.ShareViewer(ctx)
	if err != nil {
		return SharePermissions{}, err
	}
	decision, err := model.EffectiveAccess(snapshot.Entries, snapshot.Share, id, viewer)
	if err != nil {
		return SharePermissions{}, err
	}
	return sharePermissions(decision.Permissions), nil
}

func (s *Sharing) describePublicEntry(ctx context.Context, token, ticket string, entry model.Entry) (PublicEntry, error) {
	snapshot, err := s.inspect(ctx, token, ticket)
	if err != nil {
		return PublicEntry{}, err
	}
	permissions, err := s.publicPermissions(ctx, snapshot, entry.ID)
	if err != nil {
		return PublicEntry{}, err
	}
	result := publicEntry(entry)
	result.Permissions = permissions
	return result, nil
}
