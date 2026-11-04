package httpdownload

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"io"
	"mime"
	"net"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	rangeUnitPrefix      = "bytes "
	requestRangeUnit     = "bytes="
	strongDateSeparation = 60 * time.Second
)

// WithBody 只在受控回调内暴露响应流；错误响应不作为下载文件，body关闭错误不被丢弃。
func (c *Client) WithBody(ctx context.Context, input service.DownloadSourceRequest, use func(service.DownloadSourceHeaders, io.Reader) error) (resultErr error) {
	if c.closed.Load() {
		return model.ErrDownloadUnavailable
	}
	if use == nil || input.MaxBytes < 1 || input.MaxBytes > model.MaxFileContentBytes || input.OffsetBytes < 0 || input.OffsetBytes > input.MaxBytes {
		return model.ErrInvalid
	}
	normalized, _, err := c.Normalize(input.URI)
	if err != nil {
		return err
	}
	if input.OffsetBytes > 0 && (input.EffectiveURI == "" || !usableValidator(input.ValidatorKind, input.ValidatorValue)) {
		return sourceFailure(model.DownloadFailureResume, nil)
	}
	lifetime, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)
	request, err := http.NewRequestWithContext(lifetime, http.MethodGet, normalized, nil)
	if err != nil {
		return sourceFailure(model.DownloadFailureBlocked, err)
	}
	request.Header.Set("User-Agent", sourceUserAgent)
	request.Header.Set("Accept-Encoding", "identity")
	if input.OffsetBytes > 0 {
		request.Header.Set("Range", requestRangeUnit+strconv.FormatInt(input.OffsetBytes, 10)+"-")
		request.Header.Set("If-Range", input.ValidatorValue)
	}
	response, err := c.client.Do(request)
	if err != nil {
		return wrappedSourceError(err)
	}
	defer func() {
		if closeErr := response.Body.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, wrappedSourceError(closeErr))
		}
	}()
	if err := ctx.Err(); err != nil {
		return err
	}
	switch response.StatusCode {
	case http.StatusOK, http.StatusNoContent, http.StatusPartialContent, http.StatusRequestedRangeNotSatisfiable:
	default:
		return &service.DownloadSourceError{Failure: model.DownloadFailureStatus, StatusCode: response.StatusCode}
	}
	headers := service.DownloadSourceHeaders{EffectiveURI: response.Request.URL.String(), SuggestedName: suggestedName(response)}
	if input.OffsetBytes > 0 && headers.EffectiveURI != input.EffectiveURI {
		return sourceFailure(model.DownloadFailureChanged, nil)
	}
	contentEncoding := strings.TrimSpace(response.Header.Get("Content-Encoding"))
	if contentEncoding != "" && !strings.EqualFold(contentEncoding, "identity") {
		return sourceFailure(model.DownloadFailureResume, fmt.Errorf("source content encoding is unsupported"))
	}
	rawType := response.Header.Get("Content-Type")
	if len(rawType) <= model.MaxDownloadMediaTypeBytes && utf8.ValidString(rawType) {
		if media, _, parseErr := mime.ParseMediaType(rawType); parseErr == nil {
			headers.MediaType = media
		}
	}
	headers.ValidatorKind, headers.ValidatorValue = responseValidator(response)
	if input.OffsetBytes > 0 && (response.StatusCode == http.StatusPartialContent || response.StatusCode == http.StatusRequestedRangeNotSatisfiable) {
		if err := matchValidator(input, response); err != nil {
			return err
		}
		headers.ValidatorKind, headers.ValidatorValue = input.ValidatorKind, input.ValidatorValue
	}
	expected := int64(-1)
	switch response.StatusCode {
	case http.StatusOK:
		if input.OffsetBytes != 0 {
			return sourceFailure(model.DownloadFailureChanged, nil)
		}
		if response.ContentLength >= 0 {
			total := response.ContentLength
			headers.DeclaredBytes = &total
			headers.SegmentEndBytes = &total
			expected = total
		}
	case http.StatusNoContent:
		if input.OffsetBytes != 0 {
			return sourceFailure(model.DownloadFailureChanged, nil)
		}
		total := int64(0)
		headers.DeclaredBytes = &total
		headers.SegmentEndBytes = &total
		expected = 0
	case http.StatusPartialContent:
		if input.OffsetBytes == 0 {
			return sourceFailure(model.DownloadFailureChanged, nil)
		}
		start, end, total, err := parseContentRange(response.Header.Get("Content-Range"))
		if err != nil || start != input.OffsetBytes {
			return sourceFailure(model.DownloadFailureChanged, err)
		}
		expected = end - start + 1
		if response.ContentLength >= 0 && response.ContentLength != expected {
			return sourceFailure(model.DownloadFailureChanged, nil)
		}
		exclusiveEnd := end + 1
		headers.DeclaredBytes = &total
		headers.SegmentEndBytes = &exclusiveEnd
	case http.StatusRequestedRangeNotSatisfiable:
		total, err := parseUnsatisfiedRange(response.Header.Get("Content-Range"))
		if input.OffsetBytes < 1 || err != nil || total != input.OffsetBytes {
			return sourceFailure(model.DownloadFailureChanged, err)
		}
		headers.DeclaredBytes = &total
		headers.SegmentEndBytes = &total
		if input.DeclaredBytes != nil && *input.DeclaredBytes != total {
			return sourceFailure(model.DownloadFailureChanged, nil)
		}
		if total > input.MaxBytes {
			return sourceFailure(model.DownloadFailureLarge, model.ErrTooLarge)
		}
		return use(headers, bytes.NewReader(nil))
	default:
		return &service.DownloadSourceError{Failure: model.DownloadFailureStatus, StatusCode: response.StatusCode}
	}
	if input.DeclaredBytes != nil && headers.DeclaredBytes != nil && *input.DeclaredBytes != *headers.DeclaredBytes {
		return sourceFailure(model.DownloadFailureChanged, nil)
	}
	if headers.DeclaredBytes != nil && *headers.DeclaredBytes > input.MaxBytes {
		return sourceFailure(model.DownloadFailureLarge, model.ErrTooLarge)
	}
	if expected > input.MaxBytes-input.OffsetBytes {
		return sourceFailure(model.DownloadFailureLarge, model.ErrTooLarge)
	}
	bounded := &sourceBody{source: &idleBody{ctx: lifetime, cancel: cancel, source: response.Body, timeout: c.policy.IdleTimeout}, remaining: input.MaxBytes - input.OffsetBytes, expected: expected}
	if err := use(headers, bounded); err != nil {
		return err
	}
	if expected >= 0 && bounded.consumed != expected {
		return sourceFailure(model.DownloadFailureIncomplete, io.ErrUnexpectedEOF)
	}
	if !bounded.eof {
		var probe [1]byte
		n, err := bounded.Read(probe[:])
		if n != 0 {
			return sourceFailure(model.DownloadFailureIncomplete, io.ErrUnexpectedEOF)
		}
		if err != nil && !errors.Is(err, io.EOF) {
			return err
		}
		if err == nil {
			return sourceFailure(model.DownloadFailureIncomplete, io.ErrNoProgress)
		}
	}
	return ctx.Err()
}

func wrappedSourceError(err error) error {
	var existing *service.DownloadSourceError
	if errors.As(err, &existing) {
		return &service.DownloadSourceError{Failure: existing.Failure, StatusCode: existing.StatusCode, Cause: err}
	}
	code := model.DownloadFailureNetwork
	if errors.Is(err, io.ErrUnexpectedEOF) {
		code = model.DownloadFailureIncomplete
	}
	var network net.Error
	if errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &network) && network.Timeout()) {
		code = model.DownloadFailureTimeout
	}
	return sourceFailure(code, err)
}

// sourceBody 在返回额外字节前探测边界，候选文件不会因检测超额而多写一个字节。
type sourceBody struct {
	eof                           bool
	source                        io.Reader
	remaining, expected, consumed int64
}

func (r *sourceBody) Read(target []byte) (n int, resultErr error) {
	defer func() {
		if errors.Is(resultErr, io.EOF) {
			r.eof = true
		}
	}()
	if len(target) == 0 {
		return 0, nil
	}
	limit := r.remaining
	if r.expected >= 0 {
		limit = min(limit, r.expected-r.consumed)
	}
	if limit == 0 {
		var probe [1]byte
		n, err := r.source.Read(probe[:])
		if n > 0 {
			if r.expected >= 0 {
				return 0, sourceFailure(model.DownloadFailureChanged, nil)
			}
			return 0, sourceFailure(model.DownloadFailureLarge, model.ErrTooLarge)
		}
		if errors.Is(err, io.EOF) && r.expected >= 0 && r.consumed < r.expected {
			return 0, sourceFailure(model.DownloadFailureIncomplete, io.ErrUnexpectedEOF)
		}
		if err != nil && !errors.Is(err, io.EOF) {
			return 0, wrappedSourceError(err)
		}
		return 0, err
	}
	if int64(len(target)) > limit {
		target = target[:int(limit)]
	}
	n, err := r.source.Read(target)
	r.remaining -= int64(n)
	r.consumed += int64(n)
	if err != nil && !errors.Is(err, io.EOF) {
		return n, wrappedSourceError(err)
	}
	if errors.Is(err, io.EOF) && r.expected >= 0 && r.consumed < r.expected {
		return n, sourceFailure(model.DownloadFailureIncomplete, io.ErrUnexpectedEOF)
	}
	return n, err
}
func usableValidator(kind model.DownloadValidatorKind, value string) bool {
	if len(value) > model.MaxDownloadValidatorBytes {
		return false
	}
	switch kind {
	case model.DownloadValidatorETag:
		return strongETag(value)
	case model.DownloadValidatorDate:
		_, err := http.ParseTime(value)
		return err == nil
	default:
		return false
	}
}
func strongETag(value string) bool {
	if len(value) < 2 || len(value) > model.MaxDownloadValidatorBytes || !utf8.ValidString(value) || value[0] != '"' || value[len(value)-1] != '"' {
		return false
	}
	for _, character := range value[1 : len(value)-1] {
		if character < '!' || character == '"' || character == 0x7f {
			return false
		}
	}
	return true
}
func responseValidator(response *http.Response) (model.DownloadValidatorKind, string) {
	tag := response.Header.Get("ETag")
	if tag != "" {
		if strongETag(tag) {
			return model.DownloadValidatorETag, tag
		}
		return model.DownloadValidatorNone, ""
	}
	modified, err := http.ParseTime(response.Header.Get("Last-Modified"))
	if err != nil {
		return model.DownloadValidatorNone, ""
	}
	date, err := http.ParseTime(response.Header.Get("Date"))
	if err != nil || date.Sub(modified) < strongDateSeparation {
		return model.DownloadValidatorNone, ""
	}
	return model.DownloadValidatorDate, modified.UTC().Format(http.TimeFormat)
}
func matchValidator(input service.DownloadSourceRequest, response *http.Response) error {
	switch input.ValidatorKind {
	case model.DownloadValidatorETag:
		tag := response.Header.Get("ETag")
		if tag != "" && (!strongETag(tag) || tag != input.ValidatorValue) {
			return sourceFailure(model.DownloadFailureChanged, nil)
		}
	case model.DownloadValidatorDate:
		raw := response.Header.Get("Last-Modified")
		if raw != "" {
			modified, err := http.ParseTime(raw)
			expected, parseErr := http.ParseTime(input.ValidatorValue)
			if err != nil || parseErr != nil || !modified.Equal(expected) {
				return sourceFailure(model.DownloadFailureChanged, errors.Join(err, parseErr))
			}
		}
	default:
		return sourceFailure(model.DownloadFailureResume, nil)
	}
	return nil
}
func rangeInteger(raw string) (int64, error) {
	if raw == "" || len(raw) > 20 {
		return 0, model.ErrInvalid
	}
	for _, digit := range raw {
		if digit < '0' || digit > '9' {
			return 0, model.ErrInvalid
		}
	}
	result, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || result < 0 {
		return 0, errors.Join(model.ErrInvalid, err)
	}
	return result, nil
}
func parseContentRange(raw string) (start, end, total int64, resultErr error) {
	if !strings.HasPrefix(raw, rangeUnitPrefix) {
		return 0, 0, 0, model.ErrInvalid
	}
	portions := strings.Split(strings.TrimPrefix(raw, rangeUnitPrefix), "/")
	if len(portions) != 2 {
		return 0, 0, 0, model.ErrInvalid
	}
	interval := strings.Split(portions[0], "-")
	if len(interval) != 2 {
		return 0, 0, 0, model.ErrInvalid
	}
	start, errStart := rangeInteger(interval[0])
	end, errEnd := rangeInteger(interval[1])
	total, errTotal := rangeInteger(portions[1])
	if err := errors.Join(errStart, errEnd, errTotal); err != nil {
		return 0, 0, 0, err
	}
	if start > end || end >= total || total > model.MaxFileContentBytes {
		return 0, 0, 0, model.ErrInvalid
	}
	return start, end, total, nil
}
func parseUnsatisfiedRange(raw string) (int64, error) {
	const prefix = rangeUnitPrefix + "*/"
	if !strings.HasPrefix(raw, prefix) {
		return 0, model.ErrInvalid
	}
	total, err := rangeInteger(strings.TrimPrefix(raw, prefix))
	if err != nil || total > model.MaxFileContentBytes {
		return 0, errors.Join(model.ErrInvalid, err)
	}
	return total, nil
}
func suggestedName(response *http.Response) string {
	if _, parameters, err := mime.ParseMediaType(response.Header.Get("Content-Disposition")); err == nil {
		if name := parameters["filename"]; model.ValidateName(name) == nil {
			return name
		}
	}
	if response.Request != nil && response.Request.URL != nil {
		name := path.Base(response.Request.URL.Path)
		if model.ValidateName(name) == nil {
			return name
		}
	}
	return ""
}

var _ service.HTTPDownloadSource = (*Client)(nil)

// idleBody 的单次读取定时器只取消本请求，HTTP/2复用连接不会被其他任务的空闲检测破坏。
// Stop返回false时等待回调退出，定时器不会逃逸于Read或body生命周期。
type idleBody struct {
	ctx     context.Context
	cancel  context.CancelCauseFunc
	source  io.Reader
	timeout time.Duration
}

func (r *idleBody) Read(target []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, context.Cause(r.ctx)
	}
	done := make(chan struct{})
	timer := time.AfterFunc(r.timeout, func() { r.cancel(context.DeadlineExceeded); close(done) })
	n, err := r.source.Read(target)
	if !timer.Stop() {
		<-done
	}
	if r.ctx.Err() != nil {
		return n, context.Cause(r.ctx)
	}
	return n, err
}
