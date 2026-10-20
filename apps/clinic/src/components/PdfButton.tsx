import { SUPPORTED_LANGUAGES } from '@physio/core';
import { Button, cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@physio/ui';
import { ChevronDown, Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { openPdf } from '../lib/pdf';

/**
 * Print / download a PDF in the interface language, with a menu for the
 * clinic's other languages (patients often want Malayalam or Arabic).
 */
export function PdfButton({ path, label, small, variant = 'outline', icon = <Printer /> }: {
  path: string;
  label: ReactNode;
  small?: boolean;
  variant?: 'outline' | 'ghost' | 'secondary';
  icon?: ReactNode;
}) {
  const { t, i18n } = useTranslation();

  return (
    <div className="inline-flex">
      <Button variant={variant} size={small ? 'sm' : 'md'} className="rounded-e-none" onClick={() => openPdf(path)}>
        {icon}
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={small ? 'icon-sm' : 'icon'} className={cn('rounded-s-none', variant === 'outline' && 'border-s-0', !small && 'h-10')} aria-label={t('billing.pdfIn')}>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>{t('billing.pdfIn')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SUPPORTED_LANGUAGES.map((l) => (
            <DropdownMenuItem key={l.code} lang={l.code} onSelect={() => openPdf(path, l.code)} className={l.code === i18n.language ? 'font-semibold' : undefined}>
              {l.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
