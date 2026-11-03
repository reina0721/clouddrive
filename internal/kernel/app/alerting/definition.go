package alerting

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/reina0721/clouddrive/internal/kernel/app"
	pkgalerting "github.com/reina0721/clouddrive/pkg/alerting"
	"github.com/reina0721/clouddrive/pkg/logger"
)

// AlertingID 是 alerting App 组件的稳定 ID。
const AlertingID app.ID = "application.alerting"

// Definition 返回由 Application Generation 持有的安全告警组件声明。
// 启用时启动有界异步队列与 worker goroutine（生命周期 owner 为组件）；
// 禁用时输出 no-op Notifier（零行为变化，仍保持稳定 facade）。
func Definition(dependencies Dependencies) (app.Definition[pkgalerting.Notifier], error) {
	source, err := app.Configured(ConfigPath, decode, defaults{})
	if err != nil {
		return app.Definition[pkgalerting.Notifier]{}, err
	}
	return app.ManagedConfigured(
		AlertingID, source, app.FixedDependencies(dependencies),
		build, app.Leased(newAlertAccess), app.RestartRequired,
		app.WithStart(startWorker), app.WithTerminalFinalizer(stopWorker),
	)
}

// Dependencies 是 alerting 组件消费的稳定能力。
type Dependencies struct {
	Logger logger.Logger
}

// alertInstance 是 generation-local 的告警组件实例：有界队列 + 单 worker。
type alertInstance struct {
	notifier  pkgalerting.Notifier
	queue     chan pkgalerting.Event
	stop      chan struct{}
	closeOnce sync.Once
	done      chan struct{}
	logger    logger.Logger
}

// ErrQueueFull 表示入队缓冲已满（事件被丢弃以避免阻塞业务）。
var ErrQueueFull = errors.New("alerting queue is full")

func build(ctx context.Context, config Config, dependencies Dependencies) (*alertInstance, error) {
	if ctx == nil {
		return nil, errors.New("alerting build context is nil")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	instance := &alertInstance{stop: make(chan struct{}), done: make(chan struct{}), logger: dependencies.Logger}
	if !config.Enabled {
		return instance, nil
	}
	notifier, err := pkgalerting.NewWebhookNotifier(pkgalerting.WebhookConfig{URL: config.WebhookURL, SigningKey: config.SigningKey, Timeout: config.Timeout, Retries: config.Retries, RetryDelay: config.RetryDelay})
	if err != nil {
		return nil, fmt.Errorf("build alerting webhook notifier: %w", err)
	}
	instance.notifier = notifier
	instance.queue = make(chan pkgalerting.Event, config.QueueSize)
	return instance, nil
}

// startWorker 启动 worker goroutine（仅在启用且队列非 nil 时）。
func startWorker(ctx context.Context, instance *alertInstance) error {
	if instance == nil {
		return errors.New("alerting instance is nil")
	}
	if instance.queue == nil || instance.notifier == nil {
		return nil
	}
	go func() {
		for {
			select {
			case event, ok := <-instance.queue:
				if !ok {
					return
				}
				instance.post(event)
			case <-instance.stop:
				// 排空剩余队列后退出（有界，快速收敛）。
				for {
					select {
					case event, ok := <-instance.queue:
						if !ok {
							close(instance.done)
							return
						}
						instance.post(event)
					default:
						close(instance.done)
						return
					}
				}
			case <-ctx.Done():
				close(instance.done)
				return
			}
		}
	}()
	return nil
}

// stopWorker 关闭 worker 并等待排空退出。
func stopWorker(ctx context.Context, instance *alertInstance) error {
	if instance == nil {
		return errors.New("alerting instance is nil")
	}
	if instance.queue == nil {
		return nil
	}
	instance.closeOnce.Do(func() { close(instance.stop) })
	select {
	case <-instance.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// post 发送单条事件并低敏记录失败（不阻断 worker）。
func (i *alertInstance) post(event pkgalerting.Event) {
	if i == nil || i.notifier == nil {
		return
	}
	if err := i.notifier.Notify(context.Background(), event); err != nil {
		if i.logger != nil {
			i.logger.Warn("alerting event delivery failed", logger.String("event_type", event.Type), logger.String("failure", "webhook_delivery_failed"))
		}
		_ = err
	}
}

// newAlertAccess 暴露组件租约内的稳定 Notifier facade。
func newAlertAccess(lease app.Lease[*alertInstance]) (pkgalerting.Notifier, error) {
	return alertAccess{lease: lease}, nil
}

type alertAccess struct {
	lease app.Lease[*alertInstance]
}

func (access alertAccess) Notify(ctx context.Context, event pkgalerting.Event) error {
	return access.lease.Use(ctx, func(instance *alertInstance) error {
		if instance.queue == nil || instance.notifier == nil {
			return nil // 禁用：零行为
		}
		select {
		case instance.queue <- event:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		default:
			return ErrQueueFull
		}
	})
}
