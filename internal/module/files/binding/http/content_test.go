package httpbinding

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type failedContentSource struct {
	*bytes.Reader
	failure error
}

func (r failedContentSource) Read([]byte) (int, error) { return 0, r.failure }

func TestServeContentReadFailureIsRetained(t *testing.T) {
	// ServeContent 自身不返回复制错误，原始响应边界必须能在其返回后识别失败。
	cause := errors.New("test content source failure")
	reader := &contentReader{ReadSeeker: failedContentSource{Reader: bytes.NewReader([]byte("declared content")), failure: cause}}
	response := httptest.NewRecorder()
	response.Header().Set("Content-Type", "application/octet-stream")
	http.ServeContent(response, httptest.NewRequest("GET", "/content", nil), "test.bin", time.Time{}, reader)
	if !errors.Is(reader.failure, cause) {
		t.Fatal("内容源错误被 ServeContent 吞掉")
	}
	if response.Body.Len() != 0 {
		t.Fatal("失败内容被替换成成功数据")
	}
}
