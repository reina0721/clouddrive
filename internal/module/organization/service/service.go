// Package service 实现组织目录、树约束与账号组织分配用例。
package service

import (
	"context"
	"fmt"
	"sort"

	"github.com/reina0721/clouddrive/internal/module/organization/model"
	"github.com/reina0721/clouddrive/internal/module/organization/repo"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

const (
	defaultListLimit = 20
	maxListLimit     = 100
)

type AccountDirectory interface {
	RequireAssignableAccount(context.Context, string) error
}

// OperationOutcome 是操作审计的低基数结果分类（模块自有窄类型）。
type OperationOutcome string

const (
	OperationSucceeded OperationOutcome = "succeeded"
	OperationFailed    OperationOutcome = "failed"
)

// OperationAuditRequest 是 Organization 写操作审计的低敏字段域。
type OperationAuditRequest struct {
	Operation    string
	Action       string
	ResourceType string
	ResourceID   string
	Outcome      OperationOutcome
}

// OperationAuditWriter 是 Organization 写操作审计的窄 port；由 composition
// 注入 Auth OperationAuditWriter 的适配实现。
type OperationAuditWriter interface {
	RecordOperation(context.Context, OperationAuditRequest) error
}

type DepartmentList struct {
	Items         []model.Department
	Offset, Limit int
	Total         int64
}
type PositionList struct {
	Items         []model.Position
	Offset, Limit int
	Total         int64
}
type DepartmentNode struct {
	Department model.Department
	Children   []DepartmentNode
}
type DepartmentDetails struct{ Leader, Remark string }

type UpdateDepartmentCommand struct {
	Leader, Remark   *string
	ID               string
	Version          uint64
	Name             *string
	ParentID         **string
	Active, Archived *bool
}
type UpdatePositionCommand struct {
	ID               string
	Version          uint64
	Name             *string
	Active, Archived *bool
}

type Service struct {
	store          *repo.Store
	clock          clock.Clock
	ids            idgen.Generator
	accounts       AccountDirectory
	operationAudit OperationAuditWriter
}

func New(store *repo.Store, currentClock clock.Clock, ids idgen.Generator, accounts AccountDirectory) (*Service, error) {
	if store == nil || currentClock == nil || ids == nil || accounts == nil {
		return nil, fmt.Errorf("organization service dependencies are incomplete")
	}
	return &Service{store: store, clock: currentClock, ids: ids, accounts: accounts}, nil
}

// WithOperationAudit 注入业务写操作审计 writer（composition 提供 Auth 适配）；
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

func (s *Service) CreateDepartment(ctx context.Context, code, name string, parentID *string, details ...DepartmentDetails) (model.Department, error) {
	id, err := s.ids.New()
	if err != nil {
		return model.Department{}, err
	}
	department, err := model.NewDepartment(id, code, name, parentID, s.clock.Now())
	if err != nil {
		return model.Department{}, err
	}
	if len(details) > 0 {
		if len([]rune(details[0].Leader)) > 40 || len([]rune(details[0].Remark)) > 200 {
			return model.Department{}, model.ErrInvalidName
		}
		department.Leader = details[0].Leader
		department.Remark = details[0].Remark
	}
	record := departmentRecord(department)
	err = s.store.WithinTx(ctx, func(txCtx context.Context, unit *repo.Unit) error {
		if err := validateParent(txCtx, unit, department.ID, department.ParentID); err != nil {
			return err
		}
		return unit.CreateDepartment(txCtx, &record)
	})
	s.auditOperation(ctx, "organization.departments.create", "create", "department", department.ID, err)
	return department, err
}

func (s *Service) ListDepartments(ctx context.Context, offset, limit int, activeOnly bool, query string) (DepartmentList, error) {
	offset, limit, err := normalizePage(offset, limit)
	if err != nil {
		return DepartmentList{}, err
	}
	var records []repo.DepartmentRecord
	var total int64
	err = s.store.Use(ctx, func(unit *repo.Unit) error {
		var listErr error
		records, total, listErr = unit.ListDepartments(ctx, offset, limit, activeOnly, query)
		return listErr
	})
	items := make([]model.Department, len(records))
	for index, record := range records {
		items[index] = departmentModel(record)
	}
	return DepartmentList{Items: items, Offset: offset, Limit: limit, Total: total}, err
}

func (s *Service) DepartmentTree(ctx context.Context, activeOnly bool) ([]DepartmentNode, error) {
	var records []repo.DepartmentRecord
	err := s.store.Use(ctx, func(unit *repo.Unit) error {
		var listErr error
		records, listErr = unit.AllDepartments(ctx)
		return listErr
	})
	if err != nil {
		return nil, err
	}
	departments := make([]model.Department, 0, len(records))
	for _, record := range records {
		item := departmentModel(record)
		if activeOnly && (!item.Active || item.Archived) {
			continue
		}
		departments = append(departments, item)
	}
	return buildTree(departments), nil
}

func (s *Service) UpdateDepartment(ctx context.Context, command UpdateDepartmentCommand) (model.Department, error) {
	var result model.Department
	err := s.store.WithinTx(ctx, func(txCtx context.Context, unit *repo.Unit) error {
		current, err := unit.DepartmentByID(txCtx, command.ID)
		if err != nil {
			return err
		}
		changes := repo.DepartmentChanges{UpdatedAt: s.clock.Now().UTC()}
		if command.Leader != nil {
			if len([]rune(*command.Leader)) > 40 {
				return model.ErrInvalidName
			}
			changes.Leader = command.Leader
			current.Leader = *command.Leader
		}
		if command.Remark != nil {
			if len([]rune(*command.Remark)) > 200 {
				return model.ErrInvalidName
			}
			changes.Remark = command.Remark
			current.Remark = *command.Remark
		}
		if command.Name != nil {
			name, err := model.NormalizeName(*command.Name)
			if err != nil {
				return err
			}
			changes.Name = &name
			current.Name = name
		}
		if command.ParentID != nil {
			if err := validateParent(txCtx, unit, command.ID, *command.ParentID); err != nil {
				return err
			}
			changes.ParentID = command.ParentID
			current.ParentID = *command.ParentID
		}
		if command.Active != nil {
			changes.Active = command.Active
			current.Active = *command.Active
		}
		if command.Archived != nil && *command.Archived && !current.Archived {
			if err := ensureDepartmentUnreferenced(txCtx, unit, command.ID); err != nil {
				return err
			}
		}
		if command.Archived != nil {
			changes.Archived = command.Archived
			current.Archived = *command.Archived
			if *command.Archived {
				inactive := false
				changes.Active = &inactive
				current.Active = false
			}
		}
		if err := unit.UpdateDepartment(txCtx, command.ID, command.Version, changes); err != nil {
			return err
		}
		current.Version++
		current.UpdatedAt = changes.UpdatedAt
		result = departmentModel(current)
		return nil
	})
	s.auditOperation(ctx, "organization.departments.update", "update", "department", command.ID, err)
	return result, err
}

func (s *Service) CreatePosition(ctx context.Context, code, name string) (model.Position, error) {
	id, err := s.ids.New()
	if err != nil {
		return model.Position{}, err
	}
	position, err := model.NewPosition(id, code, name, s.clock.Now())
	if err != nil {
		return model.Position{}, err
	}
	record := positionRecord(position)
	err = s.store.Use(ctx, func(unit *repo.Unit) error { return unit.CreatePosition(ctx, &record) })
	s.auditOperation(ctx, "organization.positions.create", "create", "position", position.ID, err)
	return position, err
}
func (s *Service) ListPositions(ctx context.Context, offset, limit int, activeOnly bool, query string) (PositionList, error) {
	offset, limit, err := normalizePage(offset, limit)
	if err != nil {
		return PositionList{}, err
	}
	var records []repo.PositionRecord
	var total int64
	err = s.store.Use(ctx, func(unit *repo.Unit) error {
		var listErr error
		records, total, listErr = unit.ListPositions(ctx, offset, limit, activeOnly, query)
		return listErr
	})
	items := make([]model.Position, len(records))
	for index, record := range records {
		items[index] = positionModel(record)
	}
	return PositionList{Items: items, Offset: offset, Limit: limit, Total: total}, err
}
func (s *Service) UpdatePosition(ctx context.Context, command UpdatePositionCommand) (model.Position, error) {
	var result model.Position
	err := s.store.WithinTx(ctx, func(txCtx context.Context, unit *repo.Unit) error {
		current, err := unit.PositionByID(txCtx, command.ID)
		if err != nil {
			return err
		}
		changes := repo.PositionChanges{UpdatedAt: s.clock.Now().UTC()}
		if command.Name != nil {
			name, err := model.NormalizeName(*command.Name)
			if err != nil {
				return err
			}
			changes.Name = &name
			current.Name = name
		}
		if command.Active != nil {
			changes.Active = command.Active
			current.Active = *command.Active
		}
		if command.Archived != nil && *command.Archived && !current.Archived {
			count, err := unit.CountPositionAssignments(txCtx, command.ID)
			if err != nil {
				return err
			}
			if count > 0 {
				return model.ErrReferenced
			}
		}
		if command.Archived != nil {
			changes.Archived = command.Archived
			current.Archived = *command.Archived
			if *command.Archived {
				inactive := false
				changes.Active = &inactive
				current.Active = false
			}
		}
		if err := unit.UpdatePosition(txCtx, command.ID, command.Version, changes); err != nil {
			return err
		}
		current.Version++
		current.UpdatedAt = changes.UpdatedAt
		result = positionModel(current)
		return nil
	})
	s.auditOperation(ctx, "organization.positions.update", "update", "position", command.ID, err)
	return result, err
}

func (s *Service) Assignment(ctx context.Context, accountID string) (model.Assignment, error) {
	if err := s.accounts.RequireAssignableAccount(ctx, accountID); err != nil {
		return model.Assignment{}, fmt.Errorf("%w: %w", model.ErrAccountInvalid, err)
	}
	result := model.Assignment{AccountID: accountID, PositionIDs: []string{}}
	err := s.store.Use(ctx, func(unit *repo.Unit) error {
		department, err := unit.AccountDepartment(ctx, accountID)
		if err == nil {
			value := department.DepartmentID
			result.DepartmentID = &value
			result.Version = department.Version
		} else if !repo.IsNotFound(err) {
			return err
		}
		positions, err := unit.ListAccountPositions(ctx, accountID, true)
		if err != nil {
			return err
		}
		result.PositionIDs = make([]string, len(positions))
		for index, position := range positions {
			result.PositionIDs[index] = position.PositionID
		}
		return nil
	})
	return result, err
}

func (s *Service) ReplaceAssignment(ctx context.Context, accountID string, expectedVersion uint64, departmentID *string, positionIDs []string) (model.Assignment, error) {
	if err := s.accounts.RequireAssignableAccount(ctx, accountID); err != nil {
		return model.Assignment{}, fmt.Errorf("%w: %w", model.ErrAccountInvalid, err)
	}
	positionIDs = uniqueSorted(positionIDs)
	err := s.store.WithinTx(ctx, func(txCtx context.Context, unit *repo.Unit) error {
		if departmentID != nil {
			department, err := unit.DepartmentByID(txCtx, *departmentID)
			if err != nil || !department.Active || department.Archived {
				return repo.ErrNotFound
			}
		}
		for _, positionID := range positionIDs {
			position, err := unit.PositionByID(txCtx, positionID)
			if err != nil || !position.Active || position.Archived {
				return repo.ErrNotFound
			}
		}
		now := s.clock.Now().UTC()
		if err := unit.ReplaceAccountDepartment(txCtx, accountID, expectedVersion, departmentID, now); err != nil {
			return err
		}
		existing, err := unit.ListAccountPositions(txCtx, accountID, false)
		if err != nil {
			return err
		}
		next := make(map[string]struct{}, len(positionIDs))
		for _, id := range positionIDs {
			next[id] = struct{}{}
		}
		seen := map[string]struct{}{}
		for _, item := range existing {
			_, assigned := next[item.PositionID]
			seen[item.PositionID] = struct{}{}
			if err := unit.SetAccountPosition(txCtx, accountID, item.PositionID, assigned, now); err != nil {
				return err
			}
		}
		for _, id := range positionIDs {
			if _, exists := seen[id]; exists {
				continue
			}
			if err := unit.SetAccountPosition(txCtx, accountID, id, true, now); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return model.Assignment{}, err
	}
	s.auditOperation(ctx, "organization.assignments.replace", "replace", "account", accountID, nil)
	version := expectedVersion + 1
	if expectedVersion == 0 && departmentID == nil {
		version = 0
	}
	return model.Assignment{AccountID: accountID, DepartmentID: cloneString(departmentID), PositionIDs: positionIDs, Version: version}, nil
}

func validateParent(ctx context.Context, unit *repo.Unit, departmentID string, parentID *string) error {
	if parentID == nil {
		return nil
	}
	if *parentID == departmentID {
		return model.ErrCycle
	}
	currentID := *parentID
	for depth := 1; ; depth++ {
		if depth >= model.MaxTreeDepth {
			return model.ErrDepthExceeded
		}
		parent, err := unit.DepartmentByID(ctx, currentID)
		if err != nil {
			return err
		}
		if !parent.Active || parent.Archived {
			return repo.ErrNotFound
		}
		if parent.ID == departmentID {
			return model.ErrCycle
		}
		if parent.ParentID == nil {
			return nil
		}
		currentID = *parent.ParentID
	}
}
func ensureDepartmentUnreferenced(ctx context.Context, unit *repo.Unit, id string) error {
	children, err := unit.CountActiveChildren(ctx, id)
	if err != nil {
		return err
	}
	assignments, err := unit.CountDepartmentAssignments(ctx, id)
	if err != nil {
		return err
	}
	if children > 0 || assignments > 0 {
		return model.ErrReferenced
	}
	return nil
}
func normalizePage(offset, limit int) (int, int, error) {
	if offset < 0 || limit < 0 || limit > maxListLimit {
		return 0, 0, fmt.Errorf("%w: offset=%d limit=%d", model.ErrInvalidQuery, offset, limit)
	}
	if limit == 0 {
		limit = defaultListLimit
	}
	return offset, limit, nil
}
func uniqueSorted(values []string) []string {
	seen := map[string]struct{}{}
	for _, value := range values {
		if value != "" {
			seen[value] = struct{}{}
		}
	}
	result := make([]string, 0, len(seen))
	for value := range seen {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}
func cloneString(value *string) *string {
	if value == nil {
		return nil
	}
	clone := *value
	return &clone
}
func departmentRecord(value model.Department) repo.DepartmentRecord {
	return repo.DepartmentRecord{Leader: value.Leader, Remark: value.Remark, ID: value.ID, Code: value.Code, Name: value.Name, ParentID: cloneString(value.ParentID), Active: value.Active, Archived: value.Archived, Version: value.Version, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt}
}
func departmentModel(value repo.DepartmentRecord) model.Department {
	return model.Department{MemberCount: value.MemberCount, Leader: value.Leader, Remark: value.Remark, ID: value.ID, Code: value.Code, Name: value.Name, ParentID: cloneString(value.ParentID), Active: value.Active, Archived: value.Archived, Version: value.Version, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt}
}
func positionRecord(value model.Position) repo.PositionRecord {
	return repo.PositionRecord{ID: value.ID, Code: value.Code, Name: value.Name, Active: value.Active, Archived: value.Archived, Version: value.Version, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt}
}
func positionModel(value repo.PositionRecord) model.Position {
	return model.Position{ID: value.ID, Code: value.Code, Name: value.Name, Active: value.Active, Archived: value.Archived, Version: value.Version, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt}
}
func buildTree(items []model.Department) []DepartmentNode {
	byParent := map[string][]model.Department{}
	roots := []model.Department{}
	known := map[string]struct{}{}
	for _, item := range items {
		known[item.ID] = struct{}{}
	}
	for _, item := range items {
		if item.ParentID == nil {
			roots = append(roots, item)
			continue
		}
		if _, exists := known[*item.ParentID]; !exists {
			roots = append(roots, item)
			continue
		}
		byParent[*item.ParentID] = append(byParent[*item.ParentID], item)
	}
	var nodes func([]model.Department) []DepartmentNode
	nodes = func(values []model.Department) []DepartmentNode {
		result := make([]DepartmentNode, len(values))
		for index, value := range values {
			result[index] = DepartmentNode{Department: value, Children: nodes(byParent[value.ID])}
		}
		return result
	}
	return nodes(roots)
}
