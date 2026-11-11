import { Button as HeroButton } from '@heroui/react/button';
import type { ReactNode } from 'react';
import { actionStyles } from './action-styles';

type ActionBehavior =
  | Readonly<{ type?: 'button'; onPress: () => void; disabled?: boolean }>
  | Readonly<{ type: 'submit' | 'reset'; onPress?: () => void; disabled?: boolean }>
  | Readonly<{ type?: 'button'; onPress?: never; disabled: true }>;

export type ActionProps = Readonly<{
  children: ReactNode;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  expanded?: boolean;
  controls?: string;
  form?: string;
}> &
  ActionBehavior;

export function Action({
  children,
  leadingIcon,
  trailingIcon,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  expanded,
  controls,
  form,
  type = 'button',
  onPress,
}: ActionProps) {
  return (
    <HeroButton
      aria-busy={loading || undefined}
      {...(expanded === undefined ? {} : { 'aria-expanded': expanded })}
      {...(controls ? { 'aria-controls': controls } : {})}
      className={actionStyles({ fullWidth, size, variant })}
      isDisabled={disabled}
      isPending={loading}
      type={type}
      {...(form ? { form } : {})}
      variant="ghost"
      {...(onPress ? { onPress } : {})}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-icon-sm animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
        />
      ) : leadingIcon ? (
        <span
          aria-hidden="true"
          className="grid size-icon-sm shrink-0 place-items-center text-current [&>svg]:m-0"
        >
          {leadingIcon}
        </span>
      ) : null}
      <span>{children}</span>
      {trailingIcon ? (
        <span
          aria-hidden="true"
          className="grid size-icon-sm shrink-0 place-items-center text-current [&>svg]:m-0"
        >
          {trailingIcon}
        </span>
      ) : null}
    </HeroButton>
  );
}
