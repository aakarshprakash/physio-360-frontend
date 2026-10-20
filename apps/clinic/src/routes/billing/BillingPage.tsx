import { api, openFile, unwrap, type Invoice, type Payment } from '@physio/api';
import { addDays, todayInZone } from '@physio/core';
import { Button, Card, EmptyState, PageHeader, Pagination, SearchInput, Select, Skeleton, Table, Tabs, TabsContent, TabsList, TabsTrigger, Td, Th, toast, Tr } from '@physio/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Printer, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { StatusBadge } from '../../components/common';
import { toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useDebounced, useUrlState } from '../../lib/hooks';
import { openPdf } from '../../lib/pdf';
import { useSession } from '../../lib/session';
import { InvoiceEditor } from './InvoiceEditor';

export interface InvoiceFilters {
  status?: string;
  payment_status?: string;
  patient_id?: number;
  branch_id?: number | null;
  search?: string;
  page?: number;
  per_page?: number;
}

export function useInvoices(filters: InvoiceFilters) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => unwrap(api.GET('/invoices', { params: { query: filters as never } })),
    placeholderData: keepPreviousData,
  });
}

export function InvoiceTable({ invoices, loading, hidePatient }: { invoices?: Invoice[]; loading: boolean; hidePatient?: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();

  if (loading) {
    return <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11" />)}</div>;
  }
  if (!invoices?.length) return <EmptyState icon={<ReceiptText />} title={t('billing.noInvoices')} />;

  return (
    <Table>
      <thead>
        <tr>
          <Th>{t('billing.number')}</Th>
          {!hidePatient && <Th>{t('billing.patient')}</Th>}
          <Th>{t('billing.issueDate')}</Th>
          <Th className="text-end">{t('billing.total')}</Th>
          <Th className="text-end">{t('billing.balance')}</Th>
          <Th>{t('billing.status')}</Th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <Tr key={inv.id} interactive onClick={() => navigate(`/billing/invoices/${inv.id}`)}>
            <Td className="tabular font-semibold whitespace-nowrap">{inv.number ?? <span className="text-fg-muted">{t('billing.drafts')}</span>}</Td>
            {!hidePatient && (
              <Td>
                {inv.patient?.full_name}
                <div className="text-xs text-fg-muted">{inv.patient?.mrn}</div>
              </Td>
            )}
            <Td className="whitespace-nowrap text-fg-muted">{inv.issue_date ? f.local(inv.issue_date) : '—'}</Td>
            <Td className="tabular text-end font-medium whitespace-nowrap">{f.money(inv.total_minor)}</Td>
            <Td className="tabular text-end whitespace-nowrap">{inv.status === 'posted' ? f.money(Math.max(0, inv.balance_minor)) : '—'}</Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                <StatusBadge status={inv.status === 'posted' ? inv.payment_status : inv.status} />
                {inv.payer_type === 'insurance' && inv.claim_status && <StatusBadge status={inv.claim_status} />}
              </div>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

export function BillingPage() {
  const { t } = useTranslation();
  const { can, branchId } = useSession();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useUrlState('tab', 'invoices');
  const [creating, setCreating] = useState(params.get('new') === '1');
  const presetPatient = params.get('patient') ? Number(params.get('patient')) : undefined;

  return (
    <div>
      <PageHeader
        title={t('billing.title')}
        description={t('billing.subtitle')}
        actions={
          <>
            {can('reports.view') && (
              <Button variant="outline" onClick={() => openFile('/exports/invoices', 'invoices.csv').catch(toastError)}>
                <Download />
                {t('reports.exportInvoices')}
              </Button>
            )}
            {can('billing.manage') && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                {t('billing.newInvoice')}
              </Button>
            )}
          </>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="invoices">{t('billing.invoices')}</TabsTrigger>
          <TabsTrigger value="payments">{t('billing.payments')}</TabsTrigger>
          <TabsTrigger value="uninvoiced">{t('billing.uninvoiced')}</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="pt-5"><InvoicesList branchId={branchId} /></TabsContent>
        <TabsContent value="payments" className="pt-5"><PaymentsList /></TabsContent>
        <TabsContent value="uninvoiced" className="pt-5"><Uninvoiced /></TabsContent>
      </Tabs>
      {creating && (
        <InvoiceEditor
          patientId={presetPatient}
          onClose={() => {
            setCreating(false);
            setParams((p) => {
              p.delete('new');
              p.delete('patient');
              return p;
            });
          }}
        />
      )}
    </div>
  );
}

function InvoicesList({ branchId }: { branchId: number | null }) {
  const { t } = useTranslation();
  const [status, setStatus] = useUrlState('status');
  const [paymentStatus, setPaymentStatus] = useUrlState('payment_status');
  const [page, setPage] = useUrlState('page', '1');
  const [text, setText] = useState('');
  const search = useDebounced(text, 300);

  const { data, isLoading } = useInvoices({
    status: status || undefined,
    payment_status: paymentStatus || undefined,
    search: search || undefined,
    branch_id: branchId,
    page: Number(page),
    per_page: 20,
  });

  return (
    <Card>
      <div className="flex flex-wrap gap-3 border-b border-border p-4">
        <SearchInput className="min-w-60 flex-1" placeholder={`${t('billing.number')} / ${t('billing.patient')}`} aria-label={t('common:actions.search')} value={text} onChange={(e) => setText(e.target.value)} />
        <Select aria-label={t('billing.status')} className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('billing.all')}</option>
          {['draft', 'posted', 'void', 'credited'].map((s) => <option key={s} value={s}>{t(`common:status.${s}`)}</option>)}
        </Select>
        <Select aria-label={t('billing.payment')} className="w-44" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="">{t('billing.payment')}: {t('billing.all')}</option>
          <option value="outstanding">{t('billing.outstanding')}</option>
          {['unpaid', 'partially_paid', 'paid'].map((s) => <option key={s} value={s}>{t(`common:status.${s}`)}</option>)}
        </Select>
      </div>
      <InvoiceTable invoices={data?.data} loading={isLoading} />
      {data && (
        <Pagination
          page={data.meta.current_page}
          lastPage={data.meta.last_page}
          total={data.meta.total}
          onChange={(p) => setPage(String(p))}
          labels={{ previous: t('common:pagination.previous'), next: t('common:pagination.next'), page: (pg, tot) => t('common:pagination.page', { page: pg, total: tot }) }}
        />
      )}
    </Card>
  );
}

function PaymentsList() {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const today = todayInZone(f.tz);
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', from, to],
    queryFn: async () => (await unwrap(api.GET('/payments', { params: { query: { from, to } } }))).data as Payment[],
  });
  const net = (data ?? []).reduce((s, p) => s + (p.type === 'refund' ? -p.amount_minor : p.amount_minor), 0);

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
        <label className="text-[13px]">
          <span className="mb-1 block font-medium">{t('reports.range.30')}</span>
          <div className="flex gap-2">
            <input type="date" aria-label="From" className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" aria-label="To" className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </label>
        <p className="ms-auto text-sm text-fg-muted">
          {t('reports.collected')}: <span className="tabular font-semibold text-fg">{f.money(net)}</span>
        </p>
      </div>
      {isLoading ? (
        <div className="p-4"><Skeleton className="h-40" /></div>
      ) : !data?.length ? (
        <EmptyState title={t('billing.noPayments')} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('billing.receivedAt')}</Th>
              <Th>{t('billing.patient')}</Th>
              <Th>{t('billing.number')}</Th>
              <Th>{t('billing.method')}</Th>
              <Th>{t('billing.reference')}</Th>
              <Th className="text-end">{t('billing.amount')}</Th>
              <Th>{t('billing.receiptNo')}</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <Tr key={p.id} interactive onClick={() => navigate(`/billing/invoices/${p.invoice_id}`)}>
                <Td className="whitespace-nowrap">{f.instant(p.received_at, 'd MMM yyyy, h:mm a')}</Td>
                <Td>{p.patient?.full_name}</Td>
                <Td className="tabular">{p.invoice_number}</Td>
                <Td>{t(`common:paymentMethod.${p.method}`)}{p.type === 'refund' && <span className="ms-1 text-danger">({t('billing.refund')})</span>}</Td>
                <Td className="text-fg-muted">{p.reference ?? '—'}</Td>
                <Td className={`tabular text-end font-medium ${p.type === 'refund' ? 'text-danger' : ''}`}>{f.money(p.type === 'refund' ? -p.amount_minor : p.amount_minor)}</Td>
                <Td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" aria-label={`${t('billing.printReceipt')} ${p.receipt_number ?? ''}`} onClick={() => openPdf(`/payments/${p.id}/receipt`)}>
                    <Printer />
                    <span className="tabular">{p.receipt_number ?? t('billing.receipt')}</span>
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function Uninvoiced() {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['uninvoiced'],
    queryFn: async () =>
      (await unwrap(api.GET('/billing/uninvoiced-appointments')) as unknown as {
        data: { id: number; local_start: string; patient: { full_name: string; mrn: string }; practitioner: { name: string }; service: { name: string; price_minor: number } | null }[];
      }).data,
  });

  const create = useMutation({
    mutationFn: (id: number) => unwrap(api.POST('/appointments/{appointment}/invoice', { params: { path: { appointment: id } } })),
    onSuccess: (r) => {
      toast.success(t('billing.invoiceCreated'));
      void queryClient.invalidateQueries({ queryKey: ['uninvoiced'] });
      navigate(`/billing/invoices/${(r as unknown as { data: { id: number } }).data.id}`);
    },
    onError: toastError,
  });

  return (
    <Card>
      {isLoading ? (
        <div className="p-4"><Skeleton className="h-40" /></div>
      ) : !data?.length ? (
        <EmptyState icon={<ReceiptText />} title={t('billing.allInvoiced')} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('billing.visit')}</Th>
              <Th>{t('billing.patient')}</Th>
              <Th>{t('appointments.practitioner')}</Th>
              <Th>{t('appointments.service')}</Th>
              <Th className="text-end">{t('billing.amount')}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap">{f.local(a.local_start, 'EEE d MMM, h:mm a')}</Td>
                <Td>{a.patient.full_name}<div className="text-xs text-fg-muted">{a.patient.mrn}</div></Td>
                <Td>{a.practitioner.name}</Td>
                <Td>{a.service?.name ?? '—'}</Td>
                <Td className="tabular text-end">{a.service ? f.money(a.service.price_minor) : '—'}</Td>
                <Td className="text-end">
                  {can('billing.manage') && (
                    <Button size="sm" variant="secondary" loading={create.isPending && create.variables === a.id} onClick={() => create.mutate(a.id)}>
                      {t('billing.createInvoice')}
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
