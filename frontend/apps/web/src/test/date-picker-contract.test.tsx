import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DatePickerField } from '@clouddrive/ui-adapter/date-picker-field';

it('restores and clears a controlled calendar value without emitting a user edit', () => {
  const changed = vi.fn();
  const props = { label: 'Audit date', calendarLabel: 'Calendar', onValueChange: changed };
  const view = render(<DatePickerField {...props} value="2026-10-01" />);
  const values = () =>
    screen.getAllByRole('spinbutton').map((segment) => segment.getAttribute('aria-valuenow'));
  expect(values()).toEqual(expect.arrayContaining(['2026', '10', '1']));
  view.rerender(<DatePickerField {...props} value="2026-11-02" />);
  expect(values()).toEqual(expect.arrayContaining(['2026', '11', '2']));
  view.rerender(<DatePickerField {...props} value={null} />);
  expect(values().every((value) => value === null)).toBe(true);
  expect(changed).not.toHaveBeenCalled();
});
