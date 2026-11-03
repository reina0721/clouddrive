package model

import "time"

type NotificationQuery struct {
	Query, Category, Read string
	Offset, Limit         int
}
type EventQuery struct {
	Query, Operation, Result, Actor, Object string
	From, To                                *time.Time
	Offset, Limit                           int
}
type DailyCount struct {
	Time  int64 `json:"time"`
	Count int64 `json:"count"`
}
