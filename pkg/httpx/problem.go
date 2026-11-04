package httpx

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const problemContentType = "application/problem+json"

// Violation 描述一个不包含输入值的字段级协议错误。
type Violation struct {
	Field  string `json:"field"`
	Reason string `json:"reason"`
}

// Problem 是项目公开的 RFC 9457 Problem Details 契约。
type Problem struct {
	Type       string      `json:"type"`
	Title      string      `json:"title"`
	Status     int         `json:"status"`
	Detail     string      `json:"detail,omitempty"`
	Instance   string      `json:"instance,omitempty"`
	Code       string      `json:"code"`
	Violations []Violation `json:"violations,omitempty"`
}

// ProtocolProblemError 让 typed HTTP binding 在不泄漏内部错误链的前提下返回项目 Problem。
// 它只实现基于状态码的通用错误契约，不依赖具体 HTTP 框架。
type ProtocolProblemError struct {
	Problem
	status int
	cause  error
}

// NewProtocolProblemError 从项目错误映射构造可序列化的协议错误。
func NewProtocolProblemError(ctx context.Context, err error) *ProtocolProblemError {
	request := (&http.Request{}).WithContext(ctx)
	problem, _ := ProblemOf(request, err)
	return &ProtocolProblemError{Problem: problem, status: problem.Status, cause: err}
}

// Unwrap 保留已映射的项目错误，供原始内容响应复用同一协议语义。
func (e *ProtocolProblemError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.cause
}

func (e *ProtocolProblemError) Error() string {
	if e == nil {
		return ""
	}
	return e.Problem.Title
}

// GetStatus 返回 HTTP 状态，供 typed binding 的通用 status error 协议识别。
func (e *ProtocolProblemError) GetStatus() int {
	if e == nil || e.status == 0 {
		return http.StatusInternalServerError
	}
	return e.status
}

// ContentType 固定项目 Problem 的 RFC 9457 media type。
func (e *ProtocolProblemError) ContentType(string) string { return problemContentType }

type responseStateWriter struct {
	http.ResponseWriter
	status      int
	problemCode string
}

func (w *responseStateWriter) WriteHeader(status int) {
	if w.status != 0 {
		return
	}
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *responseStateWriter) Write(data []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(data)
}

func (w *responseStateWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

// ResponseCommitted 判断当前 response 是否已经提交 Header。
func ResponseCommitted(writer http.ResponseWriter) bool {
	state, ok := writer.(*responseStateWriter)
	return ok && state.status != 0
}

func responseOutcome(writer http.ResponseWriter) (status int, problemCode string, ok bool) {
	state, ok := writer.(*responseStateWriter)
	if !ok || state.status == 0 {
		return 0, "", false
	}
	return state.status, state.problemCode, true
}

// WriteProblem 把项目错误写成 RFC 9457 响应；响应已提交时不会写第二份响应。
func WriteProblem(writer http.ResponseWriter, request *http.Request, err error) {
	if writer == nil || ResponseCommitted(writer) {
		return
	}
	problem, retryAfter := ProblemOf(request, err)
	writer.Header().Set("Content-Type", problemContentType)
	if retryAfter > 0 {
		writer.Header().Set("Retry-After", fmt.Sprintf("%d", retryAfter))
	}
	if state, ok := writer.(*responseStateWriter); ok {
		state.problemCode = problem.Code
	}
	writer.WriteHeader(problem.Status)
	_ = json.NewEncoder(writer).Encode(problem)
}

// ProblemOf 把内部错误映射为不泄露 error chain 的稳定公开问题。
func ProblemOf(request *http.Request, err error) (Problem, int) {
	status := http.StatusInternalServerError
	code := errorCodeInternalServer
	detail := ""
	retryAfter := 0
	if statusErr, ok := asStatusError(err); ok {
		status = statusErrorStatusCode(statusErr)
		code = statusErrorCode(statusErr)
		detail = statusErrorMessage(statusErr)
		retryAfter = statusErr.RetryAfter
	} else {
		switch {
		case errors.Is(err, context.DeadlineExceeded):
			status, code, detail = http.StatusGatewayTimeout, "request_timeout", "request deadline exceeded"
		case errors.Is(err, context.Canceled):
			status, code, detail = http.StatusRequestTimeout, "request_canceled", "request canceled"
		}
	}
	if status < http.StatusBadRequest || status > 599 {
		status, code, detail = http.StatusInternalServerError, errorCodeInternalServer, ""
	}
	if !validProblemCode(code) {
		code = errorCodeInternalServer
	}
	problem := Problem{
		Type: "urn:clouddrive:problem:" + code, Title: http.StatusText(status),
		Status: status, Detail: detail, Code: code,
	}
	if requestID, ok := RequestIDFromContext(requestContext(request)); ok {
		problem.Instance = "urn:request:" + url.PathEscape(requestID)
	}
	return problem, retryAfter
}

func validProblemCode(code string) bool {
	if code == "" || len(code) > 64 || code[0] < 'a' || code[0] > 'z' {
		return false
	}
	for _, character := range code[1:] {
		if character != '_' && (character < 'a' || character > 'z') && (character < '0' || character > '9') {
			return false
		}
	}
	return !strings.Contains(code, "__")
}

func requestContext(request *http.Request) context.Context {
	if request == nil {
		return context.Background()
	}
	return request.Context()
}
