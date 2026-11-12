// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useRemote } from './resource-state';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it('查询切换的首次渲染即隐藏旧结果，晚到的旧响应不能覆盖新查询', async () => {
  const first = deferred<string>();
  const next = deferred<string>();
  const firstLoad = () => first.promise;
  const nextLoad = () => next.promise;
  const renders: { value: string | null; loading: boolean }[] = [];
  const { result, rerender } = renderHook(
    ({ load }) => {
      const state = useRemote(load);
      renders.push({ value: state.value, loading: state.loading });
      return state;
    },
    { initialProps: { load: firstLoad } },
  );
  await act(async () => {
    first.resolve('old');
    await first.promise;
  });
  expect(result.current.value).toBe('old');
  const before = renders.length;
  rerender({ load: nextLoad });
  expect(renders[before]).toEqual({ value: null, loading: true });
  await act(async () => {
    next.resolve('current');
    await next.promise;
  });
  expect(result.current.value).toBe('current');
  const stale = deferred<string>();
  rerender({ load: () => stale.promise });
  rerender({ load: nextLoad });
  await waitFor(() => expect(result.current.value).toBe('current'));
  await act(async () => {
    stale.resolve('stale');
    await stale.promise;
  });
  expect(result.current.value).toBe('current');
});

it('刷新立即清除旧结果，同步抛错也作为可重试的读取失败', async () => {
  let fail = false;
  const load = () => {
    if (fail) throw new Error('fixture');
    return Promise.resolve('value');
  };
  const { result } = renderHook(() => useRemote(load));
  await waitFor(() => expect(result.current.value).toBe('value'));
  fail = true;
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  expect(result.current.value).toBeNull();
  fail = false;
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.value).toBe('value'));
  expect(result.current.error).toBeNull();
});
