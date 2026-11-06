package httpbinding

import (
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"time"
)

// shareAudienceBody 只在协议边界适配对象null，不把Huma类型传入Service。
type shareAudienceBody struct {
	Anonymous     humabinding.Nullable[service.SharePermissions] `json:"anonymous"`
	Authenticated humabinding.Nullable[service.SharePermissions] `json:"authenticated"`
	Accounts      []service.AudienceRule                         `json:"accounts" maxItems:"32"`
	Roles         []service.AudienceRule                         `json:"roles" maxItems:"32"`
}

func audienceBody(value service.ShareAudience) shareAudienceBody {
	return shareAudienceBody{Anonymous: humabinding.Nullable[service.SharePermissions]{Value: value.Anonymous}, Authenticated: humabinding.Nullable[service.SharePermissions]{Value: value.Authenticated}, Accounts: value.Accounts, Roles: value.Roles}
}

func (body shareAudienceBody) service() service.ShareAudience {
	return service.ShareAudience{Anonymous: body.Anonymous.Value, Authenticated: body.Authenticated.Value, Accounts: body.Accounts, Roles: body.Roles}
}

type shareCreateBody struct {
	RootID      string                    `json:"rootId" minLength:"36" maxLength:"36"`
	Password    string                    `json:"password,omitempty" maxLength:"128"`
	ExpiresAt   *time.Time                `json:"expiresAt,omitempty"`
	Title       string                    `json:"title,omitempty" maxLength:"255"`
	Permissions *service.SharePermissions `json:"permissions,omitempty"`
	Audience    *shareAudienceBody        `json:"audience,omitempty"`
}

func (body shareCreateBody) service() service.ShareCreate {
	value := service.ShareCreate{RootID: body.RootID, Password: body.Password, ExpiresAt: body.ExpiresAt, Title: body.Title, Permissions: body.Permissions}
	if body.Audience != nil {
		audience := body.Audience.service()
		value.Audience = &audience
	}
	return value
}

type shareUpdateBody struct {
	Revision       int64                       `json:"revision" minimum:"1" maximum:"9007199254740990"`
	Title          string                      `json:"title" maxLength:"255"`
	ExpiresAt      time.Time                   `json:"expiresAt"`
	Permissions    service.SharePermissions    `json:"permissions"`
	Audience       shareAudienceBody           `json:"audience"`
	PasswordAction service.SharePasswordAction `json:"passwordAction" enum:"keep,set,remove"`
	Password       string                      `json:"password" maxLength:"128"`
}

func (body shareUpdateBody) service() service.ShareUpdate {
	return service.ShareUpdate{Revision: body.Revision, Title: body.Title, ExpiresAt: body.ExpiresAt, Permissions: body.Permissions, Audience: body.Audience.service(), PasswordAction: body.PasswordAction, Password: body.Password}
}

type shareSummaryBody struct {
	service.ShareSummary
	Audience shareAudienceBody `json:"audience"`
}

func shareBody(value service.ShareSummary) shareSummaryBody {
	return shareSummaryBody{ShareSummary: value, Audience: audienceBody(value.Audience)}
}

type shareListingBody struct {
	service.ShareListing
	Items []shareSummaryBody `json:"items"`
}

func shareListBody(value service.ShareListing) shareListingBody {
	result := shareListingBody{ShareListing: value, Items: []shareSummaryBody{}}
	for _, share := range value.Items {
		result.Items = append(result.Items, shareBody(share))
	}
	return result
}

type fileAccessPolicyBody struct {
	Default  service.SharePermissions `json:"default"`
	Audience shareAudienceBody        `json:"audience"`
}

func policyBody(value *service.FileAccessPolicy) *fileAccessPolicyBody {
	if value == nil {
		return nil
	}
	return &fileAccessPolicyBody{Default: value.Default, Audience: audienceBody(value.Audience)}
}

type accessUpdateBody struct {
	Revision int64                                      `json:"revision" minimum:"0" maximum:"9007199254740990"`
	Policy   humabinding.Nullable[fileAccessPolicyBody] `json:"policy"`
}

func (body accessUpdateBody) service() service.FileAccessUpdate {
	result := service.FileAccessUpdate{Revision: body.Revision}
	if body.Policy.Value != nil {
		policy := service.FileAccessPolicy{Default: body.Policy.Value.Default, Audience: body.Policy.Value.Audience.service()}
		result.Policy = &policy
	}
	return result
}

type fileAccessDetailBody struct {
	service.FileAccessDetail
	Policy        humabinding.Nullable[fileAccessPolicyBody] `json:"policy"`
	InheritedFrom humabinding.Nullable[service.AccessSource] `json:"inheritedFrom"`
}

func accessBody(value service.FileAccessDetail) fileAccessDetailBody {
	return fileAccessDetailBody{FileAccessDetail: value, Policy: humabinding.Nullable[fileAccessPolicyBody]{Value: policyBody(value.Policy)}, InheritedFrom: humabinding.Nullable[service.AccessSource]{Value: value.InheritedFrom}}
}

type effectiveAccessBody struct {
	service.EffectiveFileAccess
	Source humabinding.Nullable[service.AccessSource] `json:"source"`
}

func effectiveBody(value service.EffectiveFileAccess) effectiveAccessBody {
	return effectiveAccessBody{EffectiveFileAccess: value, Source: humabinding.Nullable[service.AccessSource]{Value: value.Source}}
}
