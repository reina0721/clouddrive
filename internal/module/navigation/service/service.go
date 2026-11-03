// Package service 实现后台导航策略校验、合并与 revision 快照。
package service

import (
	"context"
	"fmt"
	"sort"

	"github.com/reina0721/clouddrive/internal/module/navigation/model"
	"github.com/reina0721/clouddrive/internal/module/navigation/repo"
	"github.com/reina0721/clouddrive/pkg/clock"
)

type CatalogSnapshot struct {
	Revision    string
	Definitions []model.Definition
}
type NavigationCatalog interface {
	Snapshot() CatalogSnapshot
	Validate(CatalogSnapshot, []model.Policy) (string, error)
}

// OperationOutcome 是操作审计的低基数结果分类（模块自有窄类型）。
type OperationOutcome string

const (
	OperationSucceeded OperationOutcome = "succeeded"
	OperationFailed    OperationOutcome = "failed"
)

// OperationAuditRequest 是 Navigation 菜单策略写操作审计的低敏字段域。
type OperationAuditRequest struct {
	Operation    string
	Action       string
	ResourceType string
	ResourceID   string
	Outcome      OperationOutcome
}

// OperationAuditWriter 是 Navigation 写操作审计的窄 port；由 composition
// 注入 Auth OperationAuditWriter 的适配实现。
type OperationAuditWriter interface {
	RecordOperation(context.Context, OperationAuditRequest) error
}
type UpdateCommand struct {
	Label                  string
	PresentationPermission string
	NavigationID           string
	Enabled                bool
	ParentOverride         *string
	OrderOverride          *int
	Version                uint64
}
type Service struct {
	store          *repo.Store
	clock          clock.Clock
	catalog        NavigationCatalog
	operationAudit OperationAuditWriter
}

func New(store *repo.Store, currentClock clock.Clock, catalog NavigationCatalog) (*Service, error) {
	if store == nil || currentClock == nil || catalog == nil {
		return nil, fmt.Errorf("navigation service dependencies are incomplete")
	}
	return &Service{store: store, clock: currentClock, catalog: catalog}, nil
}

// WithOperationAudit 注入菜单策略写操作审计 writer（composition 提供 Auth 适配）；
// 未注入时写操作审计为 no-op，不阻断业务主路径。
func (s *Service) WithOperationAudit(writer OperationAuditWriter) {
	if s != nil && writer != nil {
		s.operationAudit = writer
	}
}

// auditOperation 在写操作完成边界记录低敏操作审计；writer 未注入或审计失败
// 都不阻断业务结果。
func (s *Service) auditOperation(ctx context.Context, operation, action, resourceType, resourceID string, err error) {
	if s == nil || s.operationAudit == nil {
		return
	}
	outcome := OperationSucceeded
	if err != nil {
		outcome = OperationFailed
	}
	_ = s.operationAudit.RecordOperation(ctx, OperationAuditRequest{
		Operation: operation, Action: action, ResourceType: resourceType, ResourceID: resourceID, Outcome: outcome,
	})
}

func (service *Service) Menus(ctx context.Context) ([]model.Menu, error) {
	menus, _, err := service.MenuSnapshot(ctx)
	return menus, err
}

// MenuSnapshot 在一次数据库读取中返回管理视图与对应 revision，避免列表和版本跨事务漂移。
func (service *Service) MenuSnapshot(ctx context.Context) ([]model.Menu, model.Snapshot, error) {
	snapshot, policies, revision, err := service.load(ctx)
	if err != nil {
		return nil, model.Snapshot{}, err
	}
	return merge(snapshot.Definitions, policies), model.Snapshot{CatalogRevision: snapshot.Revision, NavigationRevision: revision, Policies: clonePolicies(policies)}, nil
}
func (service *Service) Snapshot(ctx context.Context) (model.Snapshot, error) {
	catalog, policies, revision, err := service.load(ctx)
	if err != nil {
		return model.Snapshot{}, err
	}
	return model.Snapshot{CatalogRevision: catalog.Revision, NavigationRevision: revision, Policies: clonePolicies(policies)}, nil
}

func (service *Service) Update(ctx context.Context, command UpdateCommand) (model.Snapshot, error) {
	catalog := service.catalog.Snapshot()
	definition, ok := definitionByID(catalog.Definitions, command.NavigationID)
	if !ok {
		return model.Snapshot{}, model.ErrUnknown
	}
	if !definition.Manageable {
		return model.Snapshot{}, model.ErrNotManageable
	}
	policy := model.Policy{Label: command.Label, PresentationPermission: command.PresentationPermission, NavigationID: command.NavigationID, Enabled: command.Enabled, ParentOverride: cloneString(command.ParentOverride), OrderOverride: orderOverride(command.OrderOverride), CatalogRevision: catalog.Revision, Version: command.Version, UpdatedAt: service.clock.Now().UTC()}
	if err := model.ValidatePolicy(policy); err != nil {
		return model.Snapshot{}, err
	}
	err := service.store.WithinTx(ctx, func(txCtx context.Context, unit *repo.Unit) error {
		current, err := unit.List(txCtx)
		if err != nil {
			return err
		}
		candidate := policyModels(current)
		replaced := false
		for index := range candidate {
			if candidate[index].NavigationID == policy.NavigationID {
				candidate[index] = policy
				replaced = true
				break
			}
		}
		if !replaced {
			candidate = append(candidate, policy)
		}
		if err := validateCandidate(catalog, candidate); err != nil {
			return err
		}
		if _, err := service.catalog.Validate(catalog, candidate); err != nil {
			return err
		}
		record := policyRecord(policy)
		existing, err := unit.ByID(txCtx, policy.NavigationID)
		if repo.IsNotFound(err) {
			if command.Version != 0 {
				return model.ErrConflict
			}
			record.Version = 1
			return unit.Create(txCtx, &record)
		}
		if err != nil {
			return err
		}
		if existing.CatalogRevision != catalog.Revision {
			return model.ErrCatalogChanged
		}
		return unit.Update(txCtx, record, command.Version)
	})
	if err != nil {
		if repo.IsConflict(err) {
			return model.Snapshot{}, model.ErrConflict
		}
		service.auditOperation(ctx, "navigation.menus.update", "update", "menu", command.NavigationID, err)
		return model.Snapshot{}, err
	}
	service.auditOperation(ctx, "navigation.menus.update", "update", "menu", command.NavigationID, nil)
	return service.Snapshot(ctx)
}

func (service *Service) Compatible(ctx context.Context) error {
	catalog, policies, _, err := service.load(ctx)
	if err != nil {
		return err
	}
	for _, policy := range policies {
		if policy.CatalogRevision != catalog.Revision {
			return model.ErrCatalogChanged
		}
	}
	return nil
}
func (service *Service) load(ctx context.Context) (CatalogSnapshot, []model.Policy, string, error) {
	catalog := service.catalog.Snapshot()
	var records []repo.PolicyRecord
	err := service.store.Use(ctx, func(unit *repo.Unit) error { var listErr error; records, listErr = unit.List(ctx); return listErr })
	if err != nil {
		return CatalogSnapshot{}, nil, "", err
	}
	policies := policyModels(records)
	for _, policy := range policies {
		if policy.CatalogRevision != catalog.Revision {
			return CatalogSnapshot{}, nil, "", model.ErrCatalogChanged
		}
	}
	if err := validateCandidate(catalog, policies); err != nil {
		return CatalogSnapshot{}, nil, "", err
	}
	revision, err := service.catalog.Validate(catalog, policies)
	if err != nil {
		return CatalogSnapshot{}, nil, "", err
	}
	return catalog, policies, revision, nil
}
func merge(definitions []model.Definition, policies []model.Policy) []model.Menu {
	byID := map[string]model.Policy{}
	for _, policy := range policies {
		byID[policy.NavigationID] = policy
	}
	result := make([]model.Menu, 0, len(definitions))
	for _, definition := range definitions {
		menu := model.Menu{Definition: definition, Enabled: true, ParentID: definition.DefaultParentID, Order: definition.DefaultOrder}
		if policy, ok := byID[definition.ID]; ok {
			menu.Label = policy.Label
			menu.PresentationPermission = policy.PresentationPermission
			menu.Enabled = policy.Enabled
			menu.Version = policy.Version
			menu.Overridden = true
			if policy.ParentOverride != nil {
				menu.ParentID = *policy.ParentOverride
				menu.ParentOverridden = true
			}
			if policy.OrderOverride != nil {
				menu.Order = *policy.OrderOverride
				menu.OrderOverridden = true
			}
		}
		result = append(result, menu)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Order != result[j].Order {
			return result[i].Order < result[j].Order
		}
		return result[i].ID < result[j].ID
	})
	return result
}
func definitionByID(values []model.Definition, id string) (model.Definition, bool) {
	for _, value := range values {
		if value.ID == id {
			return value, true
		}
	}
	return model.Definition{}, false
}

func validateCandidate(catalog CatalogSnapshot, policies []model.Policy) error {
	parents := make(map[string]string, len(catalog.Definitions))
	known := make(map[string]model.Definition, len(catalog.Definitions))
	for _, definition := range catalog.Definitions {
		parents[definition.ID] = definition.DefaultParentID
		known[definition.ID] = definition
	}
	for _, policy := range policies {
		if err := model.ValidatePolicy(policy); err != nil {
			return err
		}
		definition, exists := known[policy.NavigationID]
		if !exists {
			return model.ErrUnknown
		}
		if !definition.Manageable {
			return model.ErrNotManageable
		}
		if policy.ParentOverride != nil {
			if *policy.ParentOverride != "" {
				parent, exists := known[*policy.ParentOverride]
				if !exists || !parent.Manageable {
					return model.ErrInvalidParent
				}
			}
			parents[policy.NavigationID] = *policy.ParentOverride
		}
	}
	for node := range parents {
		seen := map[string]struct{}{}
		for current := node; current != ""; current = parents[current] {
			if _, exists := seen[current]; exists {
				return model.ErrCycle
			}
			seen[current] = struct{}{}
		}
	}
	return nil
}
func policyModels(values []repo.PolicyRecord) []model.Policy {
	result := make([]model.Policy, len(values))
	for index, value := range values {
		result[index] = model.Policy{Label: value.Label, PresentationPermission: value.PresentationPermission, NavigationID: value.NavigationID, Enabled: value.Enabled, ParentOverride: cloneString(value.ParentOverride), OrderOverride: orderOverride(value.OrderOverride), CatalogRevision: value.CatalogRevision, Version: value.Version, UpdatedAt: value.UpdatedAt}
	}
	return result
}
func policyRecord(value model.Policy) repo.PolicyRecord {
	return repo.PolicyRecord{Label: value.Label, PresentationPermission: value.PresentationPermission, NavigationID: value.NavigationID, Enabled: value.Enabled, ParentOverride: cloneString(value.ParentOverride), OrderOverride: intOrder(value.OrderOverride), CatalogRevision: value.CatalogRevision, Version: value.Version, UpdatedAt: value.UpdatedAt}
}
func clonePolicies(values []model.Policy) []model.Policy {
	result := make([]model.Policy, len(values))
	for index, value := range values {
		value.ParentOverride = cloneString(value.ParentOverride)
		value.OrderOverride = cloneOrder(value.OrderOverride)
		result[index] = value
	}
	return result
}
func cloneString(value *string) *string {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}
func cloneOrder(value *model.Order) *model.Order {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}
func intOrder(value *model.Order) *int {
	if value == nil {
		return nil
	}
	converted := int(*value)
	return &converted
}
func orderOverride(value *int) *model.Order {
	if value == nil {
		return nil
	}
	converted := model.Order(*value)
	return &converted
}
