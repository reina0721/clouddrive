// operation_audit.go 把 Auth OperationAuditWriter 适配为各业务模块自有的
// 窄操作审计 port（与模块自有类型同构），并在 identity-access 装配时注入。
package composition

import (
	"context"

	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	authservice "github.com/reina0721/clouddrive/internal/module/auth/service"
	iamservice "github.com/reina0721/clouddrive/internal/module/iam/service"
	navigationservice "github.com/reina0721/clouddrive/internal/module/navigation/service"
	organizationservice "github.com/reina0721/clouddrive/internal/module/organization/service"
)

// iamOperationAuditAdapter 是 Auth writer 到 IAM 窄 port 的唯一适配。
type iamOperationAuditAdapter struct {
	writer authservice.OperationAuditWriter
}

func (a iamOperationAuditAdapter) RecordOperation(ctx context.Context, request iamservice.OperationAuditRequest) error {
	return a.writer.RecordOperation(ctx, authmodel.OperationAuditRequest{
		Operation: request.Operation, Action: authmodel.Action(request.Action),
		ResourceType: request.ResourceType, ResourceID: request.ResourceID,
		Outcome: authmodel.AuditOutcome(request.Outcome),
	})
}

var _ iamservice.OperationAuditWriter = iamOperationAuditAdapter{}

// organizationOperationAuditAdapter 是 Auth writer 到 Organization 窄 port 的唯一适配。
type organizationOperationAuditAdapter struct {
	writer authservice.OperationAuditWriter
}

func (a organizationOperationAuditAdapter) RecordOperation(ctx context.Context, request organizationservice.OperationAuditRequest) error {
	return a.writer.RecordOperation(ctx, authmodel.OperationAuditRequest{
		Operation: request.Operation, Action: authmodel.Action(request.Action),
		ResourceType: request.ResourceType, ResourceID: request.ResourceID,
		Outcome: authmodel.AuditOutcome(request.Outcome),
	})
}

var _ organizationservice.OperationAuditWriter = organizationOperationAuditAdapter{}

// navigationOperationAuditAdapter 是 Auth writer 到 Navigation 窄 port 的唯一适配。
type navigationOperationAuditAdapter struct {
	writer authservice.OperationAuditWriter
}

func (a navigationOperationAuditAdapter) RecordOperation(ctx context.Context, request navigationservice.OperationAuditRequest) error {
	return a.writer.RecordOperation(ctx, authmodel.OperationAuditRequest{
		Operation: request.Operation, Action: authmodel.Action(request.Action),
		ResourceType: request.ResourceType, ResourceID: request.ResourceID,
		Outcome: authmodel.AuditOutcome(request.Outcome),
	})
}

var _ navigationservice.OperationAuditWriter = navigationOperationAuditAdapter{}
