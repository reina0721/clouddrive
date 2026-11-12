// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { z } from 'zod';
import {
  FoundationControlledField,
  FoundationForm,
  useFoundationForm,
} from '@clouddrive/form-foundation';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { Action } from '@clouddrive/ui-adapter/action';

it('外部提交按钮保留嵌套字段校验、错误焦点和唯一提交入口', async () => {
  const saved: string[] = [];
  function Example() {
    const form = useFoundationForm({
      schema: z.object({ limit: z.object({ amount: z.string().regex(/^[1-9]\d*$/) }) }),
      defaultValues: { limit: { amount: '0' } },
    });
    return (
      <>
        <FoundationForm
          id="limits"
          form={form}
          onSubmit={(value) => {
            saved.push(value.limit.amount);
          }}
        >
          <FoundationControlledField form={form} name="limit">
            {(field) => (
              <TextField
                label="Limit"
                ref={field.ref}
                value={field.value.amount}
                onChange={(event) => field.onChange({ amount: event.target.value })}
              />
            )}
          </FoundationControlledField>
        </FoundationForm>
        <Action type="submit" form="limits">
          Save
        </Action>
      </>
    );
  }
  render(<Example />);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Limit')));
  expect(saved).toEqual([]);
  fireEvent.change(screen.getByLabelText('Limit'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(saved).toEqual(['2']));
});
