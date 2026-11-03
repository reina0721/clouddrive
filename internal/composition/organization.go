package composition

import (
	"context"
	"fmt"

	"github.com/reina0721/clouddrive/internal/module/iam"
	organizationservice "github.com/reina0721/clouddrive/internal/module/organization/service"
)

// organizationAccountDirectoryAdapter 是 Organization 到 IAM AccountDirectory
// facet 的唯一装配适配器。
type organizationAccountDirectoryAdapter struct{ accounts iam.AccountDirectory }

func newOrganizationAccountDirectory(accounts iam.AccountDirectory) (organizationservice.AccountDirectory, error) {
	if accounts == nil {
		return nil, fmt.Errorf("organization account directory IAM facet is nil")
	}
	return organizationAccountDirectoryAdapter{accounts: accounts}, nil
}

func (adapter organizationAccountDirectoryAdapter) RequireAssignableAccount(ctx context.Context, accountID string) error {
	return adapter.accounts.RequireAssignableAccount(ctx, accountID)
}

var _ organizationservice.AccountDirectory = organizationAccountDirectoryAdapter{}
