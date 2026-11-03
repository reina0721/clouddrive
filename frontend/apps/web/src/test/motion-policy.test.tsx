import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMotionPolicy } from '@clouddrive/surface-foundation/motion-policy-context';
import { MotionPolicyProvider } from '../host/motion-policy';
import {
  ViewportReveal,
  ViewportRevealProvider,
} from '@clouddrive/surface-foundation/viewport-reveal';

const sessionKey = 'clouddrive.motion-inspector';

function PolicyHarness() {
  const policy = useMotionPolicy();
  return (
    <div>
      <output>{`${policy.mode}:${policy.resolvedMode}:${policy.scale}`}</output>
      <button type="button" onClick={() => policy.setMode('off')}>
        disable motion
      </button>
      <button type="button" onClick={() => policy.setScale(4)}>
        slow motion
      </button>
    </div>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  delete document.documentElement.dataset.motionMode;
  document.documentElement.style.removeProperty('--motion-debug-scale');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Motion Policy', () => {
  it('从 sessionStorage 恢复开发偏好并同步语义属性', async () => {
    window.sessionStorage.setItem(
      sessionKey,
      JSON.stringify({
        mode: 'reduced',
        scale: 2,
        categories: { screen: false },
      }),
    );
    render(
      <MotionPolicyProvider>
        <PolicyHarness />
      </MotionPolicyProvider>,
    );

    expect(screen.getByText('reduced:reduced:2')).toBeVisible();
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-motion-mode', 'reduced'),
    );
    expect(document.documentElement).toHaveAttribute('data-motion-screen', 'off');
    expect(document.documentElement.style.getPropertyValue('--motion-debug-scale')).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: 'disable motion' }));
    fireEvent.click(screen.getByRole('button', { name: 'slow motion' }));
    await waitFor(() => expect(screen.getByText('off:off:4')).toBeVisible());
    expect(JSON.parse(window.sessionStorage.getItem(sessionKey) ?? '{}')).toMatchObject({
      mode: 'off',
      scale: 4,
    });
  });

  it('用单例 IntersectionObserver reveal 一次并在卸载时释放', async () => {
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    let observerCallback: IntersectionObserverCallback | undefined;
    const Observer = vi.fn(function (callback: IntersectionObserverCallback) {
      observerCallback = callback;
      return { observe, unobserve, disconnect };
    });
    vi.stubGlobal('IntersectionObserver', Observer);

    const { container, unmount } = render(
      <MotionPolicyProvider>
        <ViewportRevealProvider>
          <ViewportReveal>below fold content</ViewportReveal>
        </ViewportRevealProvider>
      </MotionPolicyProvider>,
    );
    const reveal = container.querySelector('[data-motion-recipe="reveal"]') as HTMLElement;
    await waitFor(() => expect(Observer).toHaveBeenCalledOnce());
    expect(observe).toHaveBeenCalledWith(reveal);
    expect(reveal).toHaveAttribute('data-reveal', 'pending');

    observerCallback?.(
      [{ isIntersecting: true, target: reveal } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await waitFor(() => expect(reveal).toHaveAttribute('data-reveal', 'revealed'));
    expect(unobserve).toHaveBeenCalledWith(reveal);

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
