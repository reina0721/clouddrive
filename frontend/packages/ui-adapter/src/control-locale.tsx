import { I18nProvider } from 'react-aria-components/I18nProvider';
import type { ReactNode } from 'react';
import { ControlWeekStartContext, type ControlWeekStart } from './control-locale-context';

export type ControlLocaleProviderProps = Readonly<{
  locale: string;
  weekStart?: ControlWeekStart;
  children: ReactNode;
}>;

/** Host 选择语言与周起始日；Adapter 只映射成熟控件的内置语言及日历行为。 */
export function ControlLocaleProvider({ locale, weekStart, children }: ControlLocaleProviderProps) {
  return (
    <I18nProvider locale={locale}>
      <ControlWeekStartContext value={weekStart}>{children}</ControlWeekStartContext>
    </I18nProvider>
  );
}
