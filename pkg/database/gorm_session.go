package database

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

// UseGORM 在 Client 当前有效生命周期内执行 technology-specific session 回调。
// *gorm.DB 不得保存到回调之外；Borrow 结束后其 context 会被取消。
func UseGORM(ctx context.Context, client Client, use func(*gorm.DB) error) error {
	return useGORMSession(ctx, client, use)
}

// UseGORMTx 在 Tx 当前有效生命周期内执行同一事务 session 回调。
// 事务的提交与回滚仍完全属于 Client.WithinTx。
func UseGORMTx(ctx context.Context, tx Tx, use func(*gorm.DB) error) error {
	return useGORMSession(ctx, tx, use)
}

func useGORMSession(ctx context.Context, source any, use func(*gorm.DB) error) error {
	if err := validateContext(ctx); err != nil {
		return err
	}
	if use == nil {
		return ErrNilClientFunc
	}
	provider, ok := source.(sessionProvider)
	if !ok || isNilProvider(provider) {
		return ErrClientUnavailable
	}
	session, err := provider.databaseSession(ctx)
	if err != nil {
		return err
	}
	db, ok := session.(*gorm.DB)
	if !ok || db == nil {
		return ErrClientUnavailable
	}
	callbackCtx, cancel := context.WithCancel(db.Statement.Context)
	defer cancel()
	db = db.WithContext(callbackCtx)
	if err := use(db); err != nil {
		return translateSessionError(err)
	}
	return nil
}

func translateSessionError(err error) error {
	if err == nil {
		return nil
	}
	for _, known := range []error{context.Canceled, context.DeadlineExceeded, ErrNilContext, ErrClientUnavailable, ErrNotFound, ErrDuplicateKey, ErrForeignKeyViolation, ErrOptimisticConflict, ErrInvalidIdentifier, ErrOperationFailed} {
		if errors.Is(err, known) {
			return err
		}
	}
	translated := translateError(err)
	if translated == nil {
		return nil
	}
	return fmt.Errorf("execute GORM session: %w", translated)
}
