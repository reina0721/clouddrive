package database

import (
	"context"
	"errors"
	"testing"

	"gorm.io/gorm"
)

func TestUseGORMSessionIsBoundToBorrowAndTransactionLifetime(t *testing.T) {
	resource := sqliteResource(t)
	defer resource.Close()
	var escaped *gorm.DB
	if err := Borrow(t.Context(), resource.Client(), func(client Client) error {
		return UseGORM(t.Context(), client, func(db *gorm.DB) error {
			escaped = db
			return db.Exec("SELECT 1").Error
		})
	}); err != nil {
		t.Fatal(err)
	}
	if err := escaped.Statement.Context.Err(); !errors.Is(err, context.Canceled) {
		t.Fatalf("escaped session context error = %v", err)
	}

	err := Borrow(t.Context(), resource.Client(), func(client Client) error {
		return client.WithinTx(t.Context(), func(txCtx context.Context, tx Tx) error {
			return UseGORMTx(txCtx, tx, func(db *gorm.DB) error { return db.Exec("SELECT 1").Error })
		})
	})
	if err != nil {
		t.Fatalf("transaction session error = %v", err)
	}
}

func TestUseGORMSessionTranslatesProviderErrors(t *testing.T) {
	resource := sqliteResource(t)
	defer resource.Close()
	err := Borrow(t.Context(), resource.Client(), func(client Client) error {
		return UseGORM(t.Context(), client, func(*gorm.DB) error { return gorm.ErrRecordNotFound })
	})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("error = %v", err)
	}
}

func sqliteResource(t *testing.T) Resource {
	t.Helper()
	config := DefaultConfig()
	config.Driver, config.DSN = DriverSQLite, ":memory:"
	resource, err := NewGORM(t.Context(), &config)
	if err != nil {
		t.Fatal(err)
	}
	return resource
}
