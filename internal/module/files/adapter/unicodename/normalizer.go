// Package unicodename 把 Go 官方 Unicode NFC 实现隔离在文件名称规范化边界。
package unicodename

import "golang.org/x/text/unicode/norm"

type Normalizer struct{}

// Normalize 将等价 Unicode 表示收敛为 NFC，不改变用户可见名称。
func (Normalizer) Normalize(name string) string { return norm.NFC.String(name) }
