import { createContext, useContext } from 'react';

export type ControlWeekStart = 'monday' | 'sunday';
export const ControlWeekStartContext = createContext<ControlWeekStart | undefined>(undefined);

export function useControlWeekStart() {
  return useContext(ControlWeekStartContext);
}
