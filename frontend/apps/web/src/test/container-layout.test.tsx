import { useContainerBreakpoint } from '@clouddrive/ui-adapter/container-layout';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

function Probe() {
  const { ref, matches } = useContainerBreakpoint('4xl');
  return (
    <div ref={ref} data-testid="container">
      {matches ? 'expanded' : 'compact'}
    </div>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('Container composition Browser Adapter', () => {
  it('uses the owned container and theme threshold rather than the browser width, and cleans up', () => {
    let notify: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const { unmount } = render(<Probe />);
    const element = screen.getByTestId('container');
    element.style.setProperty('--container-4xl', '56rem');
    element.ownerDocument.documentElement.style.fontSize = '16px';
    Object.defineProperty(element, 'clientWidth', { value: 895, configurable: true });
    act(() => notify?.());
    expect(element).toHaveTextContent('compact');
    Object.defineProperty(element, 'clientWidth', { value: 896, configurable: true });
    act(() => notify?.());
    expect(element).toHaveTextContent('expanded');
    element.ownerDocument.documentElement.style.fontSize = '';
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
