package webdav

import (
	"errors"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

func parseTimeout(header string, maximum time.Duration) (time.Duration, error) {
	if header == "" {
		return 0, nil
	}
	if len(header) > 1024 {
		return 0, model.ErrTooLarge
	}
	for _, candidate := range strings.Split(header, ",") {
		candidate = strings.TrimSpace(candidate)
		if candidate == "Infinite" {
			return maximum, nil
		}
		if !strings.HasPrefix(candidate, "Second-") {
			continue
		}
		seconds, err := strconv.ParseUint(strings.TrimPrefix(candidate, "Second-"), 10, 32)
		if err != nil || seconds == 0 {
			continue
		}
		return min(time.Duration(seconds)*time.Second, maximum), nil
	}
	return 0, model.ErrInvalid
}

func lockToken(header string) (string, error) {
	if len(header) > model.MaxDAVConditionBytes {
		return "", model.ErrTooLarge
	}
	parser := ifParser{text: strings.TrimSpace(header)}
	token, err := parser.angle()
	if err != nil || parser.position != len(parser.text) {
		return "", model.ErrInvalid
	}
	uri, err := url.Parse(token)
	if err != nil || uri.Scheme == "" || uri.User != nil {
		return "", model.ErrInvalid
	}
	return token, nil
}

func (p *Protocol) handleLock(writer http.ResponseWriter, request *http.Request, scope service.DAVScope, prefix string) error {
	locks := p.files.WriteLocks()
	if request.Method == MethodUnlock {
		if request.Body != nil {
			body, err := io.ReadAll(request.Body)
			if err != nil {
				return err
			}
			if len(body) != 0 {
				return model.ErrInvalid
			}
		}
		token, err := lockToken(request.Header.Get("Lock-Token"))
		if err != nil {
			return err
		}
		if err := locks.Unlock(request.Context(), scope, request.URL.Path, token); err != nil {
			return err
		}
		writer.WriteHeader(http.StatusNoContent)
		return nil
	}
	timeout, err := parseTimeout(strings.Join(request.Header.Values("Timeout"), ","), p.policy.WriteLockMaxAge)
	if err != nil {
		return err
	}
	var body []byte
	if request.Body != nil {
		body, err = io.ReadAll(request.Body)
		if err != nil {
			return err
		}
	}
	var lock model.WriteLock
	created := false
	if len(body) == 0 {
		// 刷新只携带一个正向状态令牌，Depth头按RFC忽略。
		if len(scope.Condition.Lists) != 1 || len(scope.Condition.Lists[0].Conditions) != 1 {
			return model.ErrInvalid
		}
		term := scope.Condition.Lists[0].Conditions[0]
		if term.Not || term.Token == "" {
			return model.ErrInvalid
		}
		lock, err = locks.Refresh(request.Context(), scope, request.URL.Path, term.Token, timeout)
	} else {
		mediaType, _, parseErr := mime.ParseMediaType(request.Header.Get("Content-Type"))
		if parseErr != nil || mediaType != "application/xml" && mediaType != "text/xml" {
			return model.ErrInvalid
		}
		depth := model.WriteLockDepth(request.Header.Get("Depth"))
		if depth == "" {
			depth = model.WriteLockDepthInfinity
		}
		if depth != model.WriteLockDepthZero && depth != model.WriteLockDepthInfinity {
			return model.ErrInvalid
		}
		owner, decodeErr := parseLockInfo(body)
		if decodeErr != nil {
			return decodeErr
		}
		lock, created, err = locks.Acquire(request.Context(), scope, request.URL.Path, service.DAVLockRequest{Depth: depth, OwnerXML: owner, Timeout: timeout})
		if err == nil {
			writer.Header().Set("Lock-Token", "<"+lock.Token()+">")
		}
	}
	if err != nil {
		var conflict *service.DAVLockConflict
		if errors.As(err, &conflict) {
			return writeControlXML(writer, http.StatusMultiStatus, conflictXML(request.URL.Path, prefix, conflict), p.policy.ResponseBytes)
		}
		return err
	}
	relative, err := locks.RelativeRoot(request.Context(), scope, lock)
	if err != nil {
		return err
	}
	active, err := activeLock(lock, relative, prefix, locks.Remaining(lock))
	if err != nil {
		return err
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	return writeControlXML(writer, status, lockResponseXML{Discovery: lockDiscoveryXML{Active: []activeLockXML{active}}}, p.policy.ResponseBytes)
}
