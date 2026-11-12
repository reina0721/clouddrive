import { Calendar } from '@heroui/react/calendar';
import { useControlWeekStart } from './control-locale-context';

export default function DatePickerCalendar({ calendarLabel }: Readonly<{ calendarLabel: string }>) {
  const weekStart = useControlWeekStart();
  return (
    <Calendar
      aria-label={calendarLabel}
      className="text-ink"
      {...(weekStart
        ? { firstDayOfWeek: weekStart === 'monday' ? ('mon' as const) : ('sun' as const) }
        : {})}
    >
      <Calendar.Header>
        <Calendar.YearPickerTrigger>
          <Calendar.YearPickerTriggerHeading />
          <Calendar.YearPickerTriggerIndicator />
        </Calendar.YearPickerTrigger>
        <Calendar.NavButton slot="previous" />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>
          {(day) => <Calendar.HeaderCell className="text-ink-muted">{day}</Calendar.HeaderCell>}
        </Calendar.GridHeader>
        <Calendar.GridBody>
          {(date) => (
            <Calendar.Cell
              date={date}
              className={({ isSelected, isToday }) =>
                isSelected
                  ? 'bg-brand text-on-brand hover:bg-brand-strong data-[pressed=true]:bg-brand-strong'
                  : isToday
                    ? 'bg-brand-soft text-brand hover:bg-surface-inset data-[pressed=true]:bg-surface-inset'
                    : ''
              }
            />
          )}
        </Calendar.GridBody>
      </Calendar.Grid>
    </Calendar>
  );
}
