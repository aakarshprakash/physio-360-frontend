import { api, unwrap, type Patient, type PatientPackage } from '@physio/api';
import { Button, Card, CardContent, CardHeader, EmptyState, ProgressBar } from '@physio/ui';
import { useQuery } from '@tanstack/react-query';
import { Package, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { StatusBadge } from '../../../components/common';
import { useFormat } from '../../../lib/format';
import { useSession } from '../../../lib/session';
import { InvoiceTable, useInvoices } from '../../billing/BillingPage';

export function BillingTab({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = useSession();
  const { data: invoices, isLoading } = useInvoices({ patient_id: patient.id, per_page: 50 });

  const { data: packages } = useQuery({
    queryKey: ['patient', patient.id, 'packages'],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}/packages', { params: { path: { patient: patient.id } } }))).data as PatientPackage[],
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <Card>
        <CardHeader
          title={t('billing.invoices')}
          action={
            can('billing.manage') && (
              <Button asChild size="sm">
                <Link to={`/billing?new=1&patient=${patient.id}`}>
                  <Plus />
                  {t('billing.newInvoice')}
                </Link>
              </Button>
            )
          }
        />
        <InvoiceTable invoices={invoices?.data} loading={isLoading} hidePatient />
      </Card>
      <Card>
        <CardHeader title={t('billing.packages')} />
        <CardContent>
          {!packages?.length ? (
            <EmptyState icon={<Package />} title={t('common:empty')} className="py-6" />
          ) : (
            <ul className="space-y-3">
              {packages.map((p) => (
                <li key={p.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{p.name}</p>
                    <StatusBadge status={p.status} />
                  </div>
                  <ProgressBar className="mt-2" value={(p.sessions_remaining / p.sessions_total) * 100} label={t('billing.sessionsLeft', { remaining: p.sessions_remaining, total: p.sessions_total })} />
                  <p className="mt-1.5 text-xs text-fg-muted">
                    {t('billing.sessionsLeft', { remaining: p.sessions_remaining, total: p.sessions_total })} · {t('billing.expires', { date: f.local(p.expires_on) })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
