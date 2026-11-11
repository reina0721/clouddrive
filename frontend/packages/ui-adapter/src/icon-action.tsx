import { tv } from '@heroui/styles';
import { Button as HeroButton } from '@heroui/react/button';
import type { ReactNode, Ref } from 'react';

type IconActionBehavior =
  | Readonly<{ onPress: () => void; disabled?: boolean }>
  | Readonly<{ onPress?: never; disabled: true }>;

export type IconActionProps = Readonly<{
  label: string;
  ref?: Ref<HTMLButtonElement>;
  children: ReactNode;
  active?: boolean;
  controls?: string;
  expanded?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md';
  tone?: 'neutral' | 'danger';
  tooltip?: boolean | string;
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
}> &
  IconActionBehavior;

const iconActionStyles = tv({
  base: 'ui-action shrink-0 rounded-action border-0 outline-none transition-colors',
  compoundVariants: [
    {
      active: true,
      class: 'bg-brand-soft text-brand',
      tone: 'neutral',
    },
  ],
  defaultVariants: {
    active: false,
    size: 'md',
    tone: 'neutral',
  },
  variants: {
    active: {
      false: '',
      true: '',
    },
    size: {
      md: 'size-control min-w-control',
      sm: 'size-control-sm min-w-control-sm',
    },
    tone: {
      danger: 'bg-danger-soft text-danger hover:bg-danger/15',
      neutral: 'bg-transparent text-ink-muted hover:bg-ink/8 hover:text-ink',
    },
  },
});

export function IconAction({
  label,
  ref,
  children,
  controls,
  expanded,
  onPress,
  active = false,
  disabled = false,
  loading = false,
  size = 'md',
  tone = 'neutral',
  tooltip = false,
}: IconActionProps) {
  const tooltipText = typeof tooltip === 'string' ? tooltip : tooltip ? label : undefined;

  return (
    <HeroButton
      ref={ref}
      aria-busy={loading || undefined}
      aria-label={label}
      className={iconActionStyles({ active, size, tone })}
      isDisabled={disabled}
      isIconOnly
      isPending={loading}
      variant="ghost"
      {...(tooltipText ? { title: tooltipText } : {})}
      {...(controls ? { 'aria-controls': controls } : {})}
      {...(expanded === undefined ? {} : { 'aria-expanded': expanded })}
      {...(onPress ? { onPress } : {})}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-icon-sm animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
        />
      ) : (
        children
      )}
    </HeroButton>
  );
}
