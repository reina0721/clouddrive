package storage

import (
	"fmt"
)

// ObjectPolicy 约束对象路径和 MIME。
type ObjectPolicy struct {
	AllowedMIMETypes map[string]struct{}
	MaxBytes         int64
}

// ValidateObject 校验对象大小和 MIME。
func (p ObjectPolicy) ValidateObject(info ObjectInfo) error {
	if p.MaxBytes > 0 && info.Size > p.MaxBytes {
		return fmt.Errorf("object %s exceeds %d bytes", info.Key, p.MaxBytes)
	}
	if len(p.AllowedMIMETypes) > 0 {
		if _, ok := p.AllowedMIMETypes[info.ContentType]; !ok {
			return fmt.Errorf("object %s content type %q is not allowed", info.Key, info.ContentType)
		}
	}
	return nil
}
