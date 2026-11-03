import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  ViewportReveal,
  ViewportRevealProvider,
} from '@clouddrive/surface-foundation/viewport-reveal';
import { MotionPolicyProvider } from '../host/motion-policy';

beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

it('observes leaf semantics, orders simultaneous entries by reading position, and caps stagger', async () => {
  let callback: IntersectionObserverCallback = () => undefined;
  const observe = vi.fn();
  const unobserve = vi.fn();
  vi.stubGlobal('IntersectionObserver', function (next: IntersectionObserverCallback) {
    callback = next;
    return { observe, unobserve, disconnect: vi.fn() };
  });
  let fast = false;
  const readViewport = () => ({ fast, restored: false });
  const content = (count: number) => (
    <MotionPolicyProvider>
      <ViewportRevealProvider readViewport={readViewport}>
        <ViewportReveal items>
          <div data-reveal-item data-testid="group">
            <div data-reveal-items>
              {Array.from({ length: count }, (_, index) => (
                <div key={index} data-testid={`item-${index}`}>
                  <button>item {index}</button>
                </div>
              ))}
            </div>
          </div>
        </ViewportReveal>
      </ViewportRevealProvider>
    </MotionPolicyProvider>
  );
  const view = render(content(5));
  expect(screen.getByTestId('group')).not.toHaveAttribute('data-reveal');
  expect(observe).toHaveBeenCalledTimes(5);
  const entries = (indices: number[], intersecting: boolean) =>
    indices.map((index) => ({
      target: screen.getByTestId(`item-${index}`),
      isIntersecting: intersecting,
      boundingClientRect: new DOMRect(0, index * 100, 100, 90),
      intersectionRatio: intersecting ? 1 : 0,
      rootBounds: null,
      intersectionRect: new DOMRect(),
      time: 0,
    }));
  act(() => callback(entries([4, 3, 2, 1, 0], true), {} as IntersectionObserver));
  for (let index = 0; index < 5; index++) {
    expect(screen.getByTestId(`item-${index}`)).toHaveAttribute('data-reveal-order', String(index));
    expect(screen.getByTestId(`item-${index}`)).toHaveAttribute('data-reveal-entry', 'true');
  }
  view.rerender(content(6));
  await waitFor(() => expect(observe).toHaveBeenCalledTimes(6));
  act(() => callback(entries([5], false), {} as IntersectionObserver));
  expect(screen.getByTestId('item-5')).toHaveAttribute('data-reveal', 'pending');
  fast = true;
  act(() => callback(entries([5], true), {} as IntersectionObserver));
  expect(screen.getByTestId('item-5')).toHaveAttribute('data-reveal-entry', 'false');
  fireEvent.focus(screen.getByRole('button', { name: 'item 0' }));
  expect(screen.getByTestId('item-0')).toHaveAttribute('data-reveal-entry', 'false');
  act(() => callback(entries([0], true), {} as IntersectionObserver));
  expect(screen.getByTestId('item-0')).toHaveAttribute('data-reveal-entry', 'false');
});

it('server output preserves the full reading content without an animation visibility gate', () => {
  const markup = renderToString(
    <MotionPolicyProvider>
      <ViewportReveal>
        <button>available before observation</button>
      </ViewportReveal>
    </MotionPolicyProvider>,
  );
  expect(markup).toContain('available before observation');
  expect(markup).toContain('data-reveal-entry="false"');
  expect(markup).not.toMatch(/hidden|aria-hidden|inert|opacity/);
});

function observerHarness() {
  let callback: IntersectionObserverCallback;
  const observe = vi.fn();
  const unobserve = vi.fn();
  const disconnect = vi.fn();
  const Observer = vi.fn(function (next: IntersectionObserverCallback) {
    callback = next;
    return { observe, unobserve, disconnect };
  });
  vi.stubGlobal('IntersectionObserver', Observer);
  const view = render(
    <MotionPolicyProvider>
      <ViewportRevealProvider>
        <ViewportReveal>
          <button>first region</button>
        </ViewportReveal>
        <ViewportReveal>
          <button>second region</button>
        </ViewportReveal>
      </ViewportRevealProvider>
    </MotionPolicyProvider>,
  );
  const regions = [...view.container.querySelectorAll('.surface-viewport-reveal')];
  const notify = (index: number, intersecting: boolean, bottom = 1000) => {
    act(() =>
      callback(
        [
          {
            target: regions[index],
            isIntersecting: intersecting,
            boundingClientRect: { bottom },
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    );
  };
  return { ...view, regions, notify, Observer, observe, unobserve, disconnect };
}

it('shares one observer and treats initially visible regions as stable content', () => {
  const { regions, notify, Observer, observe, unmount, disconnect } = observerHarness();
  expect(Observer).toHaveBeenCalledOnce();
  expect(Observer).toHaveBeenCalledWith(expect.any(Function), { rootMargin: '0px', threshold: 0 });
  expect(observe).toHaveBeenCalledTimes(2);
  notify(0, true);
  expect(regions[0]).toHaveAttribute('data-reveal', 'revealed');
  expect(regions[0]).toHaveAttribute('data-reveal-entry', 'false');
  expect(regions[1]).toHaveAttribute('data-reveal', 'pending');
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});

it('only animates an outside-to-visible crossing and never replays on reverse scrolling', () => {
  const { regions, notify, unobserve } = observerHarness();
  notify(0, false);
  notify(0, true);
  expect(regions[0]).toHaveAttribute('data-reveal-entry', 'true');
  expect(unobserve).toHaveBeenCalledWith(regions[0]);
  fireEvent.focus(screen.getByRole('button', { name: 'first region' }));
  expect(regions[0]).toHaveAttribute('data-reveal-entry', 'false');
  notify(0, false);
  notify(0, true);
  expect(regions[0]).toHaveAttribute('data-reveal-entry', 'false');
});

it('completes a region skipped by a fast scroll without delayed animation', () => {
  const { regions, notify } = observerHarness();
  notify(0, false);
  notify(0, false, -100);
  expect(regions[0]).toHaveAttribute('data-reveal', 'revealed');
  expect(regions[0]).toHaveAttribute('data-reveal-entry', 'false');
});

it('focus makes pending content stable even when the observer never reports', () => {
  const { regions, unobserve } = observerHarness();
  fireEvent.focus(screen.getByRole('button', { name: 'second region' }));
  expect(regions[1]).toHaveAttribute('data-reveal', 'revealed');
  expect(regions[1]).toHaveAttribute('data-reveal-entry', 'false');
  expect(unobserve).toHaveBeenCalledWith(regions[1]);
});

it.each(['missing', 'constructor failure', 'observe failure'] as const)(
  'fails open with %s',
  (failure) => {
    vi.stubGlobal(
      'IntersectionObserver',
      failure === 'missing'
        ? undefined
        : function () {
            if (failure === 'constructor failure') throw new Error('observer unavailable');
            return {
              observe: () => {
                throw new Error('cannot observe');
              },
              unobserve: vi.fn(),
              disconnect: vi.fn(),
            };
          },
    );
    const { container } = render(
      <MotionPolicyProvider>
        <ViewportRevealProvider>
          <ViewportReveal>available content</ViewportReveal>
        </ViewportRevealProvider>
      </MotionPolicyProvider>,
    );
    expect(screen.getByText('available content')).toBeVisible();
    expect(container.querySelector('.surface-viewport-reveal')).toHaveAttribute(
      'data-reveal',
      'revealed',
    );
    expect(container.querySelector('.surface-viewport-reveal')).toHaveAttribute(
      'data-reveal-entry',
      'false',
    );
  },
);
