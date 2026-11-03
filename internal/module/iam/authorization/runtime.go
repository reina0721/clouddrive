// Package authorization 实现 IAM 的授权 evaluator runtime：负责完整
// policy snapshot 的加载、mutation 候选构造与原子发布、revision 同步刷新
// 和 fail-closed 判断。runtime 不启动任何后台 goroutine，不缓存业务数据，
// 不承担数据库资源所有权。
package authorization

import (
	"context"
	"errors"
	"fmt"
	"sync"

	casbinadapter "github.com/reina0721/clouddrive/internal/module/iam/adapter/casbin"
	iampermission "github.com/reina0721/clouddrive/internal/module/iam/permission"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
)

var (
	// ErrEvaluatorUnavailable 表示 runtime 尚未加载或发布任何 evaluator；
	// 启动加载失败必须在 listener 前 abort，运行时该错误 fail closed。
	ErrEvaluatorUnavailable = errors.New("iam authorization evaluator is unavailable")
	// ErrRevisionMismatch 表示刷新后 principal revision 仍与当前授权状态
	// 不一致；禁止使用旧 evaluator 放行。
	ErrRevisionMismatch = errors.New("iam authorization revision is stale")
)

// Reason 是授权结果的低基数原因类，只用于审计与错误分类。
type Reason string

const (
	// ReasonAllowed 表示精确权限判断通过。
	ReasonAllowed Reason = "allowed"
	// ReasonDenied 表示 Casbin evaluator 返回业务拒绝。
	ReasonDenied Reason = "denied"
)

// Request 是 IAM Authorization facet 的最小判断输入。
type Request struct {
	// Subject 是账号 ID（不编码）。
	Subject string
	// Permission 是精确 PermissionKey。
	Permission permissioncatalog.Key
	// Revision 是 Principal 持有会话的 authorization revision。
	Revision uint64
	// Restricted 表示账号必须修改密码，只能使用自助权限。
	Restricted bool
}

// Decision 是 IAM RBAC 判断结果；error 只在 evaluator 不可用、数据库
// 刷新失败、取消或 revision 无法收敛时返回，业务 deny 是 Decision 而非 error。
type Decision struct {
	Allowed bool
	Reason  Reason
}

// Runtime 是 generation-local 的授权 runtime；所有 evaluator 发布与
// 刷新都通过 mu 串行化，保证旧、新 publisher 与 refresher 不会交错。
type Runtime struct {
	store     *repo.Store
	catalog   permissioncatalog.Catalog
	mu        sync.Mutex
	current   *casbinadapter.Evaluator
	candidate *casbinadapter.Evaluator
}

// New 构造不装载 evaluator 的 runtime；任何失败都必须在 Prepare 阶段返回。
func New(store *repo.Store, catalog permissioncatalog.Catalog) (*Runtime, error) {
	if store == nil {
		return nil, errors.New("iam authorization store is nil")
	}
	for _, definition := range catalog.Definitions() {
		if definition.Key == "" {
			return nil, errors.New("iam authorization catalog is incomplete")
		}
	}
	return &Runtime{store: store, catalog: catalog}, nil
}

// Load 从数据库读取当前 revision 的完整 snapshot 并发布 evaluator；
// 只允许在 Generation Prepare 的 listener 前调用一次。
func (r *Runtime) Load(ctx context.Context) error {
	if ctx == nil {
		return errors.New("iam authorization load context is nil")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	snapshot, err := r.readSnapshot(ctx)
	if err != nil {
		return fmt.Errorf("load iam authorization snapshot: %w", err)
	}
	candidate, err := casbinadapter.New(ctx, snapshot)
	if err != nil {
		return fmt.Errorf("build iam authorization evaluator: %w", err)
	}
	r.current = candidate
	return nil
}

// Decide 执行同步 fail-closed 判断。revision 不一致时在调用方 context 下
// 合并刷新（single-flight 由 mu 串行化），刷新失败、取消或仍不一致都返回
// 错误，不使用旧 evaluator 放行。
func (r *Runtime) Decide(ctx context.Context, request Request) (Decision, error) {
	if ctx == nil {
		return Decision{}, errors.New("iam authorization decide context is nil")
	}
	if err := ctx.Err(); err != nil {
		return Decision{}, err
	}
	if request.Subject == "" || request.Permission == "" {
		return Decision{}, errors.New("iam authorization request is incomplete")
	}
	if request.Restricted {
		if request.Permission != iampermission.SelfRead && request.Permission != iampermission.SelfPasswordWrite {
			// 受限（首次登录）会话的非自助权限是业务 deny，不是基础设施错误，
			// 由 Auth 映射为 403；只有 evaluator/刷新/取消失败才是 error。
			return Decision{Allowed: false, Reason: ReasonDenied}, nil
		}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	current, err := r.syncEvaluator(ctx, request.Revision)
	if err != nil {
		return Decision{}, err
	}
	allowed, err := current.Decide(ctx, request.Subject, string(request.Permission))
	if err != nil {
		return Decision{}, fmt.Errorf("iam authorization decision failed: %w", err)
	}
	if !allowed {
		return Decision{Allowed: false, Reason: ReasonDenied}, nil
	}
	return Decision{Allowed: true, Reason: ReasonAllowed}, nil
}

// ProjectPermissions 在同 revision 下导出账号的有效权限键（供 WebUI
// 投影）；授权判断仍逐 operation 走 Decide。
func (r *Runtime) ProjectPermissions(ctx context.Context, subject string, revision uint64, restricted bool) ([]permissioncatalog.Key, error) {
	if ctx == nil {
		return nil, errors.New("iam authorization projection context is nil")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if subject == "" {
		return nil, errors.New("iam authorization projection subject is empty")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	current, err := r.syncEvaluator(ctx, revision)
	if err != nil {
		return nil, err
	}
	values, err := current.PermissionsForSubject(ctx, subject)
	if err != nil {
		return nil, fmt.Errorf("iam authorization projection failed: %w", err)
	}
	result := make([]permissioncatalog.Key, 0, len(values))
	for _, value := range values {
		key := permissioncatalog.Key(value)
		if _, known := r.catalog.Lookup(key); !known {
			return nil, fmt.Errorf("%w: %q", ErrRevisionMismatch, key)
		}
		// 受限会话只投影自助权限，与服务端拒绝语义一致。
		if restricted && key != iampermission.SelfRead && key != iampermission.SelfPasswordWrite {
			continue
		}
		result = append(result, key)
	}
	return result, nil
}

// Mutate 串行化一次完整授权 mutation（数据库事务、commit 与 evaluator
// publish 三段）；调用方必须在 fn 内完成业务写入、revision bump、snapshot
// 读取与 BuildCandidate，并在 fn 返回成功后调用 PublishCandidate。
func (r *Runtime) Mutate(fn func() error) error {
	if fn == nil {
		return errors.New("iam authorization mutation function is nil")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	return fn()
}

// BuildCandidate 在事务提交前用完整 snapshot 构造候选 evaluator；
// 候选构造失败必须导致调用方事务回滚。
func (r *Runtime) BuildCandidate(ctx context.Context, snapshot repo.PolicySnapshot) error {
	if ctx == nil {
		return errors.New("iam authorization candidate context is nil")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	candidate, err := casbinadapter.New(ctx, snapshot)
	if err != nil {
		return fmt.Errorf("build iam authorization candidate: %w", err)
	}
	r.candidate = candidate
	return nil
}

// PublishCandidate 在事务 commit 后原子发布候选；只交换不可变指针，
// 不执行 I/O，不会失败。
func (r *Runtime) PublishCandidate() {
	if r.candidate != nil {
		r.current = r.candidate
		r.candidate = nil
	}
}

// syncEvaluator 保证 current evaluator 与目标 revision 一致；不一致时在
// 调用方 context 下刷新并发布最新 snapshot。mu 由调用方持有。
func (r *Runtime) syncEvaluator(ctx context.Context, revision uint64) (*casbinadapter.Evaluator, error) {
	current := r.current
	if current == nil {
		return nil, ErrEvaluatorUnavailable
	}
	if current.Revision() == revision {
		return current, nil
	}
	snapshot, err := r.readSnapshot(ctx)
	if err != nil {
		return nil, fmt.Errorf("refresh iam authorization snapshot: %w", err)
	}
	candidate, err := casbinadapter.New(ctx, snapshot)
	if err != nil {
		return nil, fmt.Errorf("build refreshed iam authorization evaluator: %w", err)
	}
	r.current = candidate
	if candidate.Revision() != revision {
		return nil, fmt.Errorf("%w: principal %d, current %d", ErrRevisionMismatch, revision, candidate.Revision())
	}
	return candidate, nil
}

func (r *Runtime) readSnapshot(ctx context.Context) (repo.PolicySnapshot, error) {
	var snapshot repo.PolicySnapshot
	err := r.store.Use(ctx, func(unit *repo.Unit) error {
		var snapshotErr error
		snapshot, snapshotErr = unit.AuthorizationSnapshot(ctx, r.catalog)
		return snapshotErr
	})
	return snapshot, err
}
