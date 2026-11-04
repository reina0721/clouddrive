package s3compat

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	storageclient "github.com/reina0721/clouddrive/pkg/storage/client"
)

// WithReader 仅在同步回调内开放 Range 读取；关闭和回调错误同时向上传递。
func (c *Client) WithReader(ctx context.Context, key string, use func(io.ReadSeeker, storageclient.ObjectInfo) error) (resultErr error) {
	if ctx == nil || use == nil {
		return fmt.Errorf("invalid object reader callback")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := validateKey(key); err != nil {
		return err
	}
	metadata, err := c.client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(c.bucket), Key: aws.String(key)})
	if err != nil {
		return fmt.Errorf("inspect object: %w", err)
	}
	if metadata.ContentLength == nil || *metadata.ContentLength < 0 {
		return fmt.Errorf("invalid object length")
	}
	info := storageclient.ObjectInfo{Key: key, Size: *metadata.ContentLength, ContentType: stringValue(metadata.ContentType), ETag: stringValue(metadata.ETag), Metadata: metadata.Metadata}
	lifetime, cancel := context.WithCancel(ctx)
	defer cancel()
	reader := &objectReader{ctx: lifetime, client: c, key: key, size: info.Size, etag: info.ETag}
	defer func() { resultErr = errors.Join(resultErr, reader.closeBody()) }()
	return use(reader, info)
}

// objectReader 由单个回调顺序使用，不支持并发；Seek 后才按实际读取位置请求对象。
type objectReader struct {
	ctx    context.Context
	client *Client
	key    string
	etag   string
	size   int64
	offset int64
	body   io.ReadCloser
}

func (r *objectReader) closeBody() error {
	if r.body == nil {
		return nil
	}
	body := r.body
	r.body = nil
	return body.Close()
}

func (r *objectReader) Read(buffer []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	if len(buffer) == 0 {
		return 0, nil
	}
	if r.offset >= r.size {
		return 0, io.EOF
	}
	if r.body == nil {
		input := &s3.GetObjectInput{Bucket: aws.String(r.client.bucket), Key: aws.String(r.key), Range: aws.String(fmt.Sprintf("bytes=%d-%d", r.offset, r.size-1))}
		if r.etag != "" {
			input.IfMatch = aws.String(r.etag)
		}
		out, err := r.client.client.GetObject(r.ctx, input)
		if err != nil {
			return 0, fmt.Errorf("read object range: %w", err)
		}
		if out.Body == nil {
			return 0, fmt.Errorf("object range body missing")
		}
		expectedRange := fmt.Sprintf("bytes %d-%d/%d", r.offset, r.size-1, r.size)
		if out.ContentLength == nil || *out.ContentLength != r.size-r.offset || stringValue(out.ContentRange) != expectedRange {
			return 0, errors.Join(fmt.Errorf("object range length changed"), out.Body.Close())
		}
		r.body = out.Body
	}
	remaining := r.size - r.offset
	if int64(len(buffer)) > remaining {
		buffer = buffer[:int(remaining)]
	}
	count, err := r.body.Read(buffer)
	r.offset += int64(count)
	if errors.Is(err, io.EOF) && r.offset < r.size {
		err = io.ErrUnexpectedEOF
	}
	return count, err
}

func (r *objectReader) Seek(offset int64, whence int) (int64, error) {
	if err := r.ctx.Err(); err != nil {
		return r.offset, err
	}
	var base int64
	switch whence {
	case io.SeekStart:
	case io.SeekCurrent:
		base = r.offset
	case io.SeekEnd:
		base = r.size
	default:
		return r.offset, fmt.Errorf("invalid object seek origin")
	}
	if offset > math.MaxInt64-base || offset < -base {
		return r.offset, fmt.Errorf("invalid object seek offset")
	}
	next := base + offset
	if next != r.offset {
		if err := r.closeBody(); err != nil {
			return r.offset, fmt.Errorf("close previous object range: %w", err)
		}
		r.offset = next
	}
	return r.offset, nil
}

type contextSource struct {
	ctx    context.Context
	source io.ReadSeeker
}

func (s *contextSource) Read(buffer []byte) (int, error) {
	if err := s.ctx.Err(); err != nil {
		return 0, err
	}
	return s.source.Read(buffer)
}
func (s *contextSource) Seek(offset int64, whence int) (int64, error) {
	if err := s.ctx.Err(); err != nil {
		return 0, err
	}
	return s.source.Seek(offset, whence)
}
