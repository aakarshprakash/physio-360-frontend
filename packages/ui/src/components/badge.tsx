import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-5',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-3 text-fg-muted',
        primary: 'bg-primary-soft text-primary-soft-fg',
        success: 'bg-success-soft text-success-soft-fg',
        warning: 'bg-warning-soft text-warning-soft-fg',
        danger: 'bg-danger-soft text-danger-soft-fg',
        info: 'bg-info-soft text-info-soft-fg',
        violet: 'bg-violet-soft text-violet-soft-fg',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Consistent colours for every status value used across the apps. */
export const STATUS_TONES: Record<string, BadgeTone> = {
  scheduled: 'info',
  confirmed: 'success',
  checked_in: 'violet',
  in_progress: 'violet',
  completed: 'neutral',
  cancelled: 'danger',
  no_show: 'warning',
  draft: 'neutral',
  posted: 'info',
  void: 'danger',
  credited: 'violet',
  paid: 'success',
  partially_paid: 'warning',
  unpaid: 'danger',
  active: 'success',
  inactive: 'neutral',
  discharged: 'neutral',
  signed: 'success',
  suspended: 'danger',
  new: 'info',
  contacted: 'violet',
  follow_up: 'warning',
  converted: 'success',
  lost: 'neutral',
  exhausted: 'neutral',
  expired: 'warning',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
  settled: 'success',
  // messaging
  queued: 'info',
  sent: 'success',
  delivered: 'success',
  failed: 'danger',
  manual: 'warning',
  // HR
  pending: 'warning',
  finalized: 'info',
  present: 'success',
  half_day: 'warning',
  absent: 'danger',
  leave: 'violet',
  holiday: 'info',
  // support
  open: 'info',
  waiting_on_clinic: 'warning',
  resolved: 'success',
  closed: 'neutral',
};
