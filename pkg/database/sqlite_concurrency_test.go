package database

import (
	"context"
	"gorm.io/gorm"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
)

func TestSQLiteReadThenWriteTransactionsSerializeWithoutSnapshotFailures(t *testing.T) {
	resource, err := NewGORM(t.Context(), &Config{Driver: DriverSQLite, DSN: filepath.Join(t.TempDir(), "concurrency.db")})
	if err != nil {
		t.Fatal(err)
	}
	defer resource.Close()
	client := resource.Client()
	if err = UseGORM(t.Context(), client, func(db *gorm.DB) error {
		return db.Exec("CREATE TABLE counters (id INTEGER PRIMARY KEY, value INTEGER NOT NULL)").Error
	}); err != nil {
		t.Fatal(err)
	}
	if err = UseGORM(t.Context(), client, func(db *gorm.DB) error { return db.Exec("INSERT INTO counters VALUES (1,0)").Error }); err != nil {
		t.Fatal(err)
	}
	const workers = 8
	const iterations = 12
	start := make(chan struct{})
	failures := make(chan error, workers)
	var group sync.WaitGroup
	for i := 0; i < workers; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			<-start
			for j := 0; j < iterations; j++ {
				err := client.WithinTx(t.Context(), func(ctx context.Context, tx Tx) error {
					return UseGORMTx(ctx, tx, func(db *gorm.DB) error {
						var prior int
						if err := db.Raw("SELECT value FROM counters WHERE id=1").Scan(&prior).Error; err != nil {
							return err
						}
						runtime.Gosched()
						return db.Exec("UPDATE counters SET value=? WHERE id=1", prior+1).Error
					})
				})
				if err != nil {
					failures <- err
					return
				}
			}
		}()
	}
	close(start)
	group.Wait()
	close(failures)
	for err := range failures {
		t.Error(err)
	}
	var actual int
	if err = UseGORM(t.Context(), client, func(db *gorm.DB) error { return db.Raw("SELECT value FROM counters WHERE id=1").Scan(&actual).Error }); err != nil {
		t.Fatal(err)
	}
	if actual != workers*iterations {
		t.Fatalf("committed increments=%d want %d", actual, workers*iterations)
	}
}
