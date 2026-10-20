import { useId } from 'react';
import { cn } from '../utils';

/** Physio360 mark: a figure in motion formed by sage leaves, with a spine of dots. */
export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  const id = useId().replace(/:/g, '');
  const head = inverted ? '#ffffff' : '#142D36';
  return (
    <svg viewBox="0 0 48 48" className={cn('size-9', className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-g1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8BC9B4" />
          <stop offset="1" stopColor="#2F7D66" />
        </linearGradient>
        <linearGradient id={`${id}-g2`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#65A995" />
          <stop offset="1" stopColor={inverted ? '#A9D8C8' : '#1F5F4D'} />
        </linearGradient>
      </defs>
      <circle cx="19" cy="7.5" r="4.5" fill={head} />
      <path d="M8 15c6 1 11 5 13 12 1.5 5 1 11-2 17-1-7-3-12-7-16-3-3-5-8-4-13Z" fill={`url(#${id}-g2)`} />
      <path d="M42 4c-2 9-7 15-14 19-4 2-6 6-6 11 0 4 1 7 3 10 5-4 9-10 11-17 2-6 4-15 6-23Z" fill={`url(#${id}-g1)`} />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={13 - i * 0.6} cy={21 + i * 5.5} r={1.6 - i * 0.15} fill={inverted ? '#cfe5dd' : '#142D36'} opacity={0.85} />
      ))}
    </svg>
  );
}

export function Logo({ className, inverted, showTagline = true }: { className?: string; inverted?: boolean; showTagline?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} dir="ltr">
      <LogoMark inverted={inverted} />
      <span className="flex flex-col leading-none">
        <span className={cn('text-[19px] font-extrabold tracking-tight', inverted ? 'text-white' : 'text-[#142D36] dark:text-white')}>
          Physio<span className={inverted ? 'text-[#65A995]' : 'text-[#2F7D66] dark:text-[#65A995]'}>360</span>
        </span>
        {showTagline && (
          <span className={cn('mt-0.5 text-[9px] font-semibold tracking-[0.18em]', inverted ? 'text-white/60' : 'text-fg-subtle')}>BY SYSNAC</span>
        )}
      </span>
    </span>
  );
}
