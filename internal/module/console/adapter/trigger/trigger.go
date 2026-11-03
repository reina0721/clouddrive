// Package trigger 把 cron 库限制在可替换的日期计算边界。
package trigger

import (
	"github.com/robfig/cron/v3"
	"time"
)

func Next(expression string, now time.Time) (time.Time, error) {
	value, err := cron.ParseStandard(expression)
	if err != nil {
		return time.Time{}, err
	}
	return value.Next(now.UTC()), nil
}
