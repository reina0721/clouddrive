import { ReadyImage } from '@clouddrive/ui-adapter/ready-image';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('ReadyImage', () => {
  it('decode 完成前保留固定空间，完成后再显示图片', async () => {
    let resolveDecode: (value?: void) => void = () => undefined;
    const decode = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDecode = resolve;
        }),
    );
    render(
      <ReadyImage
        alt="数据预览"
        error={<span>图片不可用</span>}
        height={180}
        src="/preview.png"
        width={320}
      />,
    );

    const image = screen.getByRole('img', { name: '数据预览' });
    Object.defineProperty(image, 'decode', { configurable: true, value: decode });
    fireEvent.load(image);
    expect(image.parentElement).toHaveAttribute('aria-busy', 'true');
    expect(image.parentElement).toHaveStyle({ aspectRatio: '320 / 180' });

    resolveDecode();
    await waitFor(() => expect(image.parentElement).toHaveAttribute('data-state', 'ready'));
    expect(image.parentElement).not.toHaveAttribute('aria-busy');
  });

  it('加载失败时保留尺寸并呈现调用方错误内容', () => {
    render(
      <ReadyImage
        alt="失败预览"
        error={<span>图片不可用</span>}
        height={90}
        src="/missing.png"
        width={160}
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: '失败预览' }));
    expect(screen.getByText('图片不可用')).toBeVisible();
    expect(screen.getByRole('img', { name: '失败预览' }).parentElement).toHaveAttribute(
      'data-state',
      'error',
    );
  });
});
