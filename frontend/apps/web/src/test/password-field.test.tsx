import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PasswordField, TextField } from '@clouddrive/ui-adapter/form-field';
import type { FormEvent } from 'react';

it('changes visibility without changing password value or submitting its form', () => {
  const submit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <PasswordField
        label="Password"
        purpose="current"
        defaultValue="retained"
        showLabel="Show"
        hideLabel="Hide"
      />
    </form>,
  );
  const input = screen.getByLabelText('Password');
  expect(input).toHaveAttribute('type', 'password');
  expect(input).toHaveAttribute('autocomplete', 'current-password');
  fireEvent.click(screen.getByRole('button', { name: 'Show' }));
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveValue('retained');
  expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-pressed', 'true');
  expect(submit).not.toHaveBeenCalled();
});

it('preserves validation and disabled states; regular text fields retain their default purpose', () => {
  render(
    <>
      <PasswordField
        label="New password"
        purpose="new"
        error="Password invalid"
        showLabel="Show"
        hideLabel="Hide"
        disabled
      />
      <TextField label="Ordinary text" />
    </>,
  );
  expect(screen.getByLabelText('New password')).toBeDisabled();
  expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('New password')).toHaveAttribute('autocomplete', 'new-password');
  expect(screen.getByRole('button', { name: 'Show' })).toBeDisabled();
  expect(screen.getByText('Password invalid')).toBeVisible();
  expect(screen.getByLabelText('Ordinary text')).toHaveAttribute('type', 'text');
});
