import type { Prescription } from '@physio/api';
import { Badge, Button, Card } from '@physio/ui';
import { CalendarClock, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PdfButton } from '../../components/PdfButton';
import { useFormat } from '../../lib/format';

/** One prescription as a readable card: what the patient takes home. */
export function PrescriptionCard({ rx, showPatient, onEdit }: { rx: Prescription; showPatient?: boolean; onEdit?: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className="tabular">{rx.number}</span>
            {showPatient && rx.patient && (
              <Link to={`/patients/${rx.patient.id}?tab=prescriptions`} className="truncate text-primary hover:underline">
                {rx.patient.full_name}
              </Link>
            )}
          </p>
          <p className="text-xs text-fg-muted">
            {f.local(rx.issued_on)} · {rx.practitioner?.name}
          </p>
        </div>
        {rx.review_on && (
          <Badge tone="info">
            <CalendarClock className="size-3" />
            {t('prescriptions.reviewOn')}: {f.local(rx.review_on, 'd MMM')}
          </Badge>
        )}
        {rx.can_edit && onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil />
            {t('common:actions.edit')}
          </Button>
        )}
        <PdfButton small path={`/prescriptions/${rx.id}/pdf`} label={t('prescriptions.print')} />
      </div>
      <div className="grid gap-4 px-5 py-4 text-sm md:grid-cols-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t('prescriptions.diagnosis')}</p>
          <p className="whitespace-pre-line">{rx.diagnosis || '—'}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t('prescriptions.modalities')}</p>
          {rx.modalities.length ? (
            <ul className="space-y-1">
              {rx.modalities.map((m, i) => (
                <li key={i}>
                  <span className="font-medium">{m.name}</span>
                  <span className="text-fg-muted">
                    {[m.parameters, m.duration_minutes ? t('common:units.minutes', { count: m.duration_minutes }) : null, m.sessions ? `× ${m.sessions}` : null].filter(Boolean).map((x) => ` · ${x}`)}
                  </span>
                </li>
              ))}
            </ul>
          ) : '—'}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t('prescriptions.exercises')}</p>
          {rx.exercises.length ? (
            <ul className="space-y-1">
              {rx.exercises.map((x, i) => (
                <li key={i}>
                  <span className="font-medium">{x.name}</span>
                  {x.dosage && <span className="text-fg-muted"> · {x.dosage}</span>}
                </li>
              ))}
            </ul>
          ) : '—'}
        </div>
        {(rx.advice || rx.precautions) && (
          <div className="grid gap-4 md:col-span-3 md:grid-cols-2">
            {rx.advice && (
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t('prescriptions.advice')}</p>
                <p className="whitespace-pre-line">{rx.advice}</p>
              </div>
            )}
            {rx.precautions && (
              <div className="rounded-lg bg-warning-soft/60 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-warning-soft-fg">{t('prescriptions.precautions')}</p>
                <p className="whitespace-pre-line">{rx.precautions}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
