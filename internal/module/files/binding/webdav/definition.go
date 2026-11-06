// Package webdav 声明并承载独立文件连接协议，不把扩展方法伪装为Huma JSON。
package webdav

import (
	"net/http"
	"strings"

	protocol "github.com/reina0721/clouddrive/internal/module/files/adapter/webdav"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

const Prefix = "/dav/"
const Security = "file-connection"

func Endpoint(id string) string { return Prefix + id + "/" }

type Method struct {
	Name     string
	Access   service.ConnectionAccess
	Transfer bool
}
type Definition struct {
	Prefix   string
	Security string
	Methods  []Method
}

// Metadata 是协议方法及预算的唯一无资源声明；每次返回独立切片。
func Metadata() Definition {
	return Definition{Prefix: Prefix, Security: Security, Methods: []Method{
		{Name: http.MethodOptions, Access: service.ConnectionRead},
		{Name: protocol.MethodPropFind, Access: service.ConnectionRead},
		{Name: protocol.MethodPropPatch, Access: service.ConnectionWrite},
		{Name: http.MethodGet, Access: service.ConnectionRead, Transfer: true},
		{Name: http.MethodHead, Access: service.ConnectionRead, Transfer: true},
		{Name: http.MethodPut, Access: service.ConnectionWrite, Transfer: true},
		{Name: protocol.MethodMkcol, Access: service.ConnectionWrite},
		{Name: protocol.MethodCopy, Access: service.ConnectionWrite},
		{Name: protocol.MethodMove, Access: service.ConnectionWrite},
		{Name: http.MethodDelete, Access: service.ConnectionWrite},
		{Name: protocol.MethodLock, Access: service.ConnectionWrite, Transfer: true},
		{Name: protocol.MethodUnlock, Access: service.ConnectionWrite},
	}}
}
func (d Definition) Method(name string) (Method, bool) {
	for _, method := range d.Methods {
		if method.Name == name {
			return method, true
		}
	}
	return Method{}, false
}
func MatchPath(path string) (id, relative string, matched bool) {
	if !strings.HasPrefix(path, Prefix) {
		return "", "", false
	}
	remainder := strings.TrimPrefix(path, Prefix)
	id, tail, hasPath := strings.Cut(remainder, "/")
	if idgen.Validate(id) != nil {
		return "", "", false
	}
	if !hasPath {
		return id, "/", true
	}
	return id, "/" + tail, true
}
func (d Definition) TransferRequest(request *http.Request) bool {
	if _, _, ok := MatchPath(request.URL.Path); !ok {
		return false
	}
	method, ok := d.Method(request.Method)
	return ok && method.Transfer
}
