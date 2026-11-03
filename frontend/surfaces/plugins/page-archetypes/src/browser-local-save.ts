import { useCallback, useEffect, useRef } from 'react';

/** Browser lifecycle for the local form demonstration, not a backend request. */
export function useLocalSaveSimulation(): () => Promise<boolean> {
  const pending = useRef<{
    timer: number;
    finish: (completed: boolean) => void;
  } | null>(null);
  useEffect(
    () => () => {
      const operation = pending.current;
      if (!operation) return;
      window.clearTimeout(operation.timer);
      operation.finish(false);
      pending.current = null;
    },
    [],
  );
  return useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        const previous = pending.current;
        if (previous) {
          window.clearTimeout(previous.timer);
          previous.finish(false);
        }
        const timer = window.setTimeout(() => {
          pending.current = null;
          resolve(true);
        }, 450);
        pending.current = { timer, finish: resolve };
      }),
    [],
  );
}
