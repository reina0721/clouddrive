import { tv } from '@heroui/styles';

export const actionStyles = tv({
  base: 'inline-flex rounded-control font-semibold outline-none transition-colors',
  defaultVariants: {
    fullWidth: false,
    size: 'md',
    variant: 'primary',
  },
  variants: {
    fullWidth: {
      false: '',
      true: 'w-full',
    },
    size: {
      lg: 'h-control-lg gap-2.5 px-5 text-base',
      md: 'h-control gap-2 px-4 text-sm',
      sm: 'h-control-sm gap-1.5 px-3 text-sm',
    },
    variant: {
      danger: 'bg-danger text-on-danger shadow-sm hover:brightness-95',
      primary: 'bg-brand text-on-brand shadow-sm hover:bg-brand-strong',
      quiet: 'bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink',
      secondary: 'border border-border bg-surface text-ink shadow-sm hover:bg-surface-muted',
    },
  },
});
