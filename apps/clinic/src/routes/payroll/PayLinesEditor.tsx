import type { PayLine } from '@physio/api';
import { Button, Input } from '@physio/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MoneyInput } from '../../components/common';
import { useFormat } from '../../lib/format';

/** Editable list of named amounts (allowances, deductions, payslip lines) with a running total. */
export function PayLinesEditor({ legend, lines, onChange, addLabel, placeholder }: { legend: string; lines: PayLine[]; onChange: (lines: PayLine[]) => void; addLabel: string; placeholder: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const total = lines.reduce((s, l) => s + (l.amount_minor || 0), 0);

  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold">
        <span>{legend}</span>
        <span className="tabular text-fg-muted">{f.money(total)}</span>
      </legend>
      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-[1fr_150px_auto] gap-2">
            <Input aria-label={`${legend} ${i + 1}: ${t('payroll.lineName')}`} placeholder={placeholder} value={line.name} onChange={(e) => onChange(lines.map((l, j) => (j === i ? { ...l, name: e.target.value } : l)))} />
            <MoneyInput aria-label={`${legend} ${i + 1}: ${t('payroll.amount')}`} value={line.amount_minor} onChange={(v) => onChange(lines.map((l, j) => (j === i ? { ...l, amount_minor: v ?? 0 } : l)))} />
            <Button variant="ghost" size="icon" aria-label={t('payroll.remove')} onClick={() => onChange(lines.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange([...lines, { name: '', amount_minor: 0 }])}>
          <Plus />
          {addLabel}
        </Button>
      </div>
    </fieldset>
  );
}
