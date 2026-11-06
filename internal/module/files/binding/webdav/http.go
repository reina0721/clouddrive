package webdav

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"

	protocol "github.com/reina0721/clouddrive/internal/module/files/adapter/webdav"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/httpx"
	"github.com/reina0721/clouddrive/pkg/logger"
)

const basicChallenge = `Basic realm="clouddrive WebDAV", charset="UTF-8"`

type Handler struct {
	boundary     *handler.Handler
	protocol     *protocol.Protocol
	definition   Definition
	policy       service.ConnectionPolicy
	maxFileBytes int64
}

func New(boundary *handler.Handler, files *service.DAVFiles, policy service.ConnectionPolicy, maxFileBytes int64) (*Handler, error) {
	if boundary == nil || boundary.Connections == nil || boundary.Logger == nil || boundary.Service == nil || maxFileBytes < 1 {
		return nil, model.ErrInvalid
	}
	adapter, err := protocol.New(files, policy)
	if err != nil {
		return nil, err
	}
	return &Handler{boundary: boundary, protocol: adapter, definition: Metadata(), policy: policy, maxFileBytes: maxFileBytes}, nil
}
func (h *Handler) allowedOrigin(request *http.Request, origin string) bool {
	if h.boundary.ConnectionOrigin != "" && origin == h.boundary.ConnectionOrigin {
		return true
	}
	if httpx.SameOrigin(request, origin) {
		return true
	}
	for _, candidate := range h.boundary.PublicOrigins {
		if candidate == origin {
			return true
		}
	}
	return false
}
func escapedPathValid(path string) bool {
	lower := strings.ToLower(path)
	return !strings.Contains(lower, "%2f") && !strings.Contains(lower, "%5c") && !strings.Contains(lower, "%00")
}

func (h *Handler) destination(request *http.Request, id string) (string, error) {
	return h.resource(request, id, request.Header.Get("Destination"))
}

func (h *Handler) resource(request *http.Request, id, value string) (string, error) {
	target, err := url.Parse(value)
	if err != nil || target.User != nil || target.RawQuery != "" || target.Fragment != "" || !escapedPathValid(target.EscapedPath()) {
		return "", model.ErrInvalid
	}
	if target.Host != "" {
		if (target.Scheme != "http" && target.Scheme != "https") || !h.allowedOrigin(request, target.Scheme+"://"+target.Host) {
			return "", service.ErrConnectionUnavailable
		}
	} else if target.Scheme != "" {
		return "", model.ErrInvalid
	}
	targetID, relative, ok := MatchPath(target.Path)
	if !ok || targetID != id {
		return "", service.ErrConnectionUnavailable
	}
	return relative, nil
}

func (h *Handler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "private, no-store")
	writer.Header().Set("Referrer-Policy", "no-referrer")
	writer.Header().Set("X-Content-Type-Options", "nosniff")
	method, known := h.definition.Method(request.Method)
	if !known {
		h.reject(writer, request, http.StatusMethodNotAllowed, nil)
		return
	}
	id, relative, matched := MatchPath(request.URL.Path)
	if !matched || !escapedPathValid(request.URL.EscapedPath()) || request.Header.Get("X-HTTP-Method-Override") != "" {
		h.reject(writer, request, http.StatusBadRequest, nil)
		return
	}
	if method.Access == service.ConnectionWrite {
		origin := request.Header.Get("Origin")
		if origin != "" && !h.allowedOrigin(request, origin) {
			h.reject(writer, request, http.StatusForbidden, nil)
			return
		}
	}
	username, password, ok := request.BasicAuth()
	if !ok {
		writer.Header().Set("WWW-Authenticate", basicChallenge)
		h.reject(writer, request, http.StatusUnauthorized, nil)
		return
	}
	connection, err := h.boundary.Connections.Authenticate(request.Context(), id, username, password)
	if err != nil {
		status := protocol.ErrorStatus(err)
		if errors.Is(err, service.ErrConnectionCredentials) || errors.Is(err, model.ErrMissing) {
			status = http.StatusUnauthorized
			writer.Header().Set("WWW-Authenticate", basicChallenge)
		}
		h.reject(writer, request, status, err)
		return
	}
	scope := service.DAVScope{ConnectionID: connection.ID, Revision: connection.Revision}
	if method.Access == service.ConnectionWrite {
		if _, _, err := h.boundary.Connections.Check(request.Context(), id, connection.Revision, service.ConnectionWrite); err != nil {
			h.reject(writer, request, protocol.ErrorStatus(err), err)
			return
		}
	}
	if len(request.Header.Values("If")) > 1 || len(request.Header.Values("Lock-Token")) > 1 || request.Header.Get("Lock-Token") != "" && request.Method != protocol.MethodUnlock {
		h.reject(writer, request, http.StatusBadRequest, nil)
		return
	}
	scope.Condition, err = protocol.ParseIfHeader(request.Header.Get("If"), relative, func(tag string) (string, error) { return h.resource(request, id, tag) })
	if err != nil {
		h.reject(writer, request, protocol.ErrorStatus(err), err)
		return
	}
	clone := request.Clone(request.Context())
	uri := *request.URL
	uri.Path = relative
	uri.RawPath = ""
	clone.URL = &uri
	if request.Method == protocol.MethodCopy || request.Method == protocol.MethodMove {
		destination, err := h.destination(request, id)
		if err != nil {
			h.reject(writer, request, protocol.ErrorStatus(err), err)
			return
		}
		clone.Header.Set("Destination", destination)
	}
	if request.Method == http.MethodOptions {
		allowed := []string{}
		for _, candidate := range h.definition.Methods {
			if !connection.ReadOnly || candidate.Access == service.ConnectionRead {
				allowed = append(allowed, candidate.Name)
			}
		}
		writer.Header().Set("Allow", strings.Join(allowed, ", "))
		writer.Header().Set("DAV", "1, 2")
		writer.Header().Set("MS-Author-Via", "DAV")
		writer.WriteHeader(http.StatusNoContent)
		return
	}
	if request.Method == http.MethodPut && request.Header.Get("Content-Range") != "" {
		h.reject(writer, request, http.StatusBadRequest, nil)
		return
	}
	if request.Method == http.MethodPut && request.ContentLength > h.maxFileBytes {
		h.reject(writer, request, http.StatusRequestEntityTooLarge, nil)
		return
	}
	if method.Transfer {
		release, err := h.boundary.Service.AcquireUpload(request.Context())
		if err != nil {
			h.reject(writer, request, protocol.ErrorStatus(err), err)
			return
		}
		defer release()
	}
	// 公共预算中间件会包装空Body；恢复明确零长度语义，让协议库识别无XML的PROPFIND。
	if request.ContentLength == 0 {
		clone.Body = http.NoBody
	} else if request.Method == http.MethodPut {
		clone.Body = http.MaxBytesReader(writer, request.Body, h.maxFileBytes+1)
	} else if request.Body != nil && request.Body != http.NoBody {
		clone.Body = http.MaxBytesReader(writer, request.Body, h.policy.XMLBytes)
	}
	observed := &responseState{ResponseWriter: writer}
	err = h.protocol.Handle(observed, clone, scope, Prefix+id)
	if err == nil {
		if (request.Method == protocol.MethodLock || request.Method == protocol.MethodUnlock) && observed.status != http.StatusMultiStatus {
			h.boundary.Logger.Info("files.webdav.lock.changed", logger.String("phase", request.Method), logger.Int("status", observed.status))
		}
		return
	}
	status := protocol.ErrorStatus(err)
	if observed.started {
		h.logFailure(request, status)
		panic(http.ErrAbortHandler)
	}
	h.reject(writer, request, status, err)
}
func (h *Handler) logFailure(request *http.Request, status int) {
	if status >= 500 && !errors.Is(request.Context().Err(), context.DeadlineExceeded) {
		h.boundary.Logger.Error("files.webdav.request.failed", logger.String("phase", "respond"), logger.Int("status", status))
	}
}
func (h *Handler) reject(writer http.ResponseWriter, request *http.Request, status int, _ error) {
	h.logFailure(request, status)
	http.Error(writer, http.StatusText(status), status)
}

type responseState struct {
	http.ResponseWriter
	started bool
	status  int
}

func (w *responseState) WriteHeader(status int) {
	if w.started {
		return
	}
	w.started = true
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}
func (w *responseState) Write(body []byte) (int, error) {
	if !w.started {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(body)
}
func (w *responseState) Unwrap() http.ResponseWriter { return w.ResponseWriter }
