import { tv } from '@heroui/styles';

export const actionStyles = tv({
  base: 'ui-action inline-flex items-center justify-center rounded-action font-medium outline-none transition-colors',
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
      danger: 'border-0 bg-danger text-on-danger hover:brightness-95',
      primary: 'border-0 bg-brand text-on-brand hover:bg-brand-strong',
      quiet: 'border-0 bg-transparent text-brand hover:bg-brand/8',
      secondary: 'border border-border-strong bg-transparent text-brand hover:bg-brand/8',
    },
  },
});
