import { api, openFile, unwrap } from '@physio/api';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, toast } from '@physio/ui';
import { useMutation } from '@tanstack/react-query';
import { CreditCard, Download, ReceiptText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMyInvoices } from '../lib/data';
import { useFormat, useSession } from '../lib/session';
import { errorText } from './util';

export function BillingPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const { clinic } = useSession();
  const { data, isLoading } = useMyInvoices();

  const pay = useMutation({
    mutationFn: (id: number) => unwrap(api.POST('/patient/invoices/{invoice}/pay', { params: { path: { invoice: id } } })),
    onSuccess: (r) => {
      // Payment happens on Razorpay's hosted page; the signed webhook records it.
      window.location.assign((r as unknown as { data: { url: string } }).data.url);
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <div>
      <PageHeader title={t('billing.title')} />
      <div className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : !data?.length ? (
          <Card><EmptyState icon={<ReceiptText />} title={t('billing.none')} /></Card>
        ) : (
          data.map((inv) => {
            const due = inv.status === 'posted' && inv.balance_minor > 0;
            return (
              <Card key={inv.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="tabular font-semibold">{inv.number}</p>
                    <p className="text-sm text-fg-muted">{inv.issue_date && f.local(inv.issue_date, 'd MMM yyyy')}</p>
                  </div>
                  <Badge tone={due ? 'warning' : 'success'}>{due ? t('billing.due') : t('billing.paid')}</Badge>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="text-sm">
                    <p className="text-fg-muted">{t('billing.total')}: <span className="tabular font-medium text-fg">{f.money(inv.total_minor)}</span></p>
                    {due && <p className="text-fg-muted">{t('billing.balance')}: <span className="tabular font-semibold text-fg">{f.money(inv.balance_minor)}</span></p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openFile(`/patient/invoices/${inv.id}/pdf`).catch((e) => toast.error(errorText(e)))}><Download />{t('billing.download')}</Button>
                    {due && clinic.online_payments_enabled && (
                      <Button size="sm" loading={pay.isPending && pay.variables === inv.id} onClick={() => pay.mutate(inv.id)}><CreditCard />{t('billing.pay')}</Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
