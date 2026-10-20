import { api, unwrap, type Invoice, type PaymentMethodCode } from '@physio/api';
import { todayInZone } from '@physio/core';
import { Alert, Button, Card, CardContent, CardHeader, ConfirmDialog, Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, ErrorState, Field, Input, PageLoader, Select, Table, Td, Textarea, Th, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CreditCard, Download, FileMinus, Link2, MoreHorizontal, Pencil, Printer, RotateCcw, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { MoneyInput, StatusBadge } from '../../components/common';
import { PdfButton } from '../../components/PdfButton';
import { errorMessage, toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { openPdf } from '../../lib/pdf';
import { useSession } from '../../lib/session';
import { InvoiceEditor } from './InvoiceEditor';

type DialogKind = 'pay' | 'refund' | 'credit' | 'void' | 'claim' | 'edit' | null;

export function InvoicePage() {
  const { t } = useTranslation();
  const f = useFormat();
  const { invoiceId } = useParams();
  const id = Number(invoiceId);
  const navigate = useNavigate();
  const { can, session } = useSession();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [issueDate, setIssueDate] = useState('');

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => (await unwrap(api.GET('/invoices/{invoice}', { params: { path: { invoice: id } } }))).data as Invoice,
  });

  const refresh = (inv?: Invoice) => {
    if (inv) queryClient.setQueryData(['invoice', id], inv);
    void queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const post = useMutation({
    mutationFn: () => unwrap(api.POST('/invoices/{invoice}/post', { params: { path: { invoice: id } }, body: { issue_date: issueDate || null } as never })),
    onSuccess: (r) => {
      const inv = (r as unknown as { data: Invoice }).data;
      toast.success(t('billing.posted', { number: inv.number }));
      refresh(inv);
    },
    onError: toastError,
  });

  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/invoices/{invoice}', { params: { path: { invoice: id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate('/billing');
    },
    onError: toastError,
  });

  const link = useMutation({
    mutationFn: () => unwrap(api.POST('/invoices/{invoice}/payment-link', { params: { path: { invoice: id } } })),
    onSuccess: async (r) => {
      const url = (r as unknown as { data: { url: string } }).data.url;
      await navigator.clipboard?.writeText(url).catch(() => undefined);
      toast.success(`${t('billing.linkCreated')}: ${url}`);
    },
    onError: toastError,
  });

  if (isLoading) return <PageLoader />;
  if (error || !invoice) return <ErrorState title={t('common:errors.notFound')} />;

  const isDraft = invoice.status === 'draft';
  const isPosted = invoice.status === 'posted';
  const manage = can('billing.manage');
  const reverse = can('billing.void');
  const balance = Math.max(0, invoice.balance_minor);

  return (
    <div className="space-y-5">
      <Link to="/billing" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t('billing.invoices')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="tabular text-2xl font-bold tracking-tight">{invoice.number ?? t('common:status.draft')}</h1>
            <StatusBadge status={invoice.status} />
            {isPosted && <StatusBadge status={invoice.payment_status} />}
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            <Link to={`/patients/${invoice.patient?.id}`} className="font-medium text-fg hover:underline">{invoice.patient?.full_name}</Link> · {invoice.patient?.mrn}
            {invoice.issue_date && <> · {t('billing.issueDate')}: {f.local(invoice.issue_date)}</>}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isDraft && manage && (
            <>
              <Button variant="outline" onClick={() => setDialog('edit')}>
                <Pencil />
                {t('common:actions.edit')}
              </Button>
              <ConfirmDialog
                title={t('billing.post')}
                description={t('billing.postConfirm')}
                confirmLabel={t('billing.post')}
                cancelLabel={t('common:actions.cancel')}
                onConfirm={() => post.mutateAsync()}
                trigger={
                  <Button>
                    <Send />
                    {t('billing.post')}
                  </Button>
                }
              >
                <Field label={t('billing.issueBackdate')}>
                  <Input type="date" max={todayInZone(f.tz)} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </Field>
              </ConfirmDialog>
            </>
          )}
          {isPosted && manage && balance > 0 && (
            <Button onClick={() => setDialog('pay')}>
              <CreditCard />
              {t('billing.recordPayment')}
            </Button>
          )}
          {!isDraft && <PdfButton path={`/invoices/${id}/pdf`} label={t('billing.downloadPdf')} icon={<Download />} />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t('common:actions.more')}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {isPosted && manage && balance > 0 && session.tenant.online_payments_enabled && (
                <DropdownMenuItem onSelect={() => link.mutate()}>
                  <Link2 />
                  {t('billing.paymentLink')}
                </DropdownMenuItem>
              )}
              {isPosted && manage && invoice.payer_type === 'insurance' && (
                <DropdownMenuItem onSelect={() => setDialog('claim')}>
                  <ShieldCheck />
                  {t('billing.claim')}
                </DropdownMenuItem>
              )}
              {isPosted && reverse && invoice.amount_paid_minor > 0 && (
                <DropdownMenuItem onSelect={() => setDialog('refund')}>
                  <RotateCcw />
                  {t('billing.refund')}
                </DropdownMenuItem>
              )}
              {isPosted && reverse && (
                <DropdownMenuItem onSelect={() => setDialog('credit')}>
                  <FileMinus />
                  {t('billing.creditNote')}
                </DropdownMenuItem>
              )}
              {isPosted && reverse && invoice.amount_paid_minor === 0 && invoice.amount_credited_minor === 0 && (
                <DropdownMenuItem tone="danger" onSelect={() => setDialog('void')}>
                  <Ban />
                  {t('billing.void')}
                </DropdownMenuItem>
              )}
              {isDraft && manage && (
                <DropdownMenuItem tone="danger" onSelect={() => remove.mutate()}>
                  <Trash2 />
                  {t('billing.deleteDraft')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {invoice.status === 'void' && <Alert tone="danger">{t('billing.voidedBecause', { reason: invoice.void_reason })}</Alert>}

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title={t('billing.items')} />
          <Table>
            <thead>
              <tr>
                <Th>{t('billing.description')}</Th>
                <Th className="text-end">{t('billing.qty')}</Th>
                <Th className="text-end">{t('billing.unitPrice')}</Th>
                <Th className="text-end">{t('billing.discount')}</Th>
                <Th className="text-end">{t('billing.tax')}</Th>
                <Th className="text-end">{t('billing.amount')}</Th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((i) => (
                <tr key={i.id}>
                  <Td>{i.description}</Td>
                  <Td className="tabular text-end">{i.quantity}</Td>
                  <Td className="tabular text-end">{f.money(i.unit_price_minor)}</Td>
                  <Td className="tabular text-end">{i.discount_minor ? f.money(i.discount_minor) : '—'}</Td>
                  <Td className="tabular text-end">{i.tax_rate_bp ? `${i.tax_rate_bp / 100}%` : '—'}</Td>
                  <Td className="tabular text-end font-medium">{f.money(i.total_minor)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <CardContent className="flex justify-end pt-4">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <Row label={t('billing.subtotal')} value={f.money(invoice.subtotal_minor)} />
              {invoice.discount_minor > 0 && <Row label={t('billing.discount')} value={`− ${f.money(invoice.discount_minor)}`} />}
              <Row label={t('billing.taxTotal')} value={f.money(invoice.tax_minor)} />
              <Row label={t('billing.grandTotal')} value={f.money(invoice.total_minor)} strong />
              {invoice.amount_credited_minor > 0 && <Row label={t('common:status.credited')} value={`− ${f.money(invoice.amount_credited_minor)}`} />}
              {!isDraft && <Row label={t('billing.paid')} value={`− ${f.money(invoice.amount_paid_minor)}`} />}
              {!isDraft && <Row label={t('billing.balance')} value={f.money(balance)} strong />}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title={t('billing.history')} />
            <CardContent>
              {!invoice.payments?.length ? (
                <p className="text-sm text-fg-muted">{t('billing.noPayments')}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div>
                        <p className="font-medium">
                          {t(`common:paymentMethod.${p.method}`)}
                          {p.type === 'refund' && <span className="ms-1 text-danger">({t('billing.refund')})</span>}
                        </p>
                        <p className="text-xs text-fg-muted">
                          {p.receipt_number && <span className="tabular">{p.receipt_number} · </span>}
                          {f.instant(p.received_at, 'd MMM yyyy')} {p.reference && `· ${p.reference}`} {p.received_by && `· ${p.received_by}`}
                        </p>
                      </div>
                      <span className="flex items-center gap-1">
                        <span className={`tabular font-semibold ${p.type === 'refund' ? 'text-danger' : ''}`}>{f.money(p.type === 'refund' ? -p.amount_minor : p.amount_minor)}</span>
                        <Button variant="ghost" size="icon-sm" aria-label={`${t('billing.printReceipt')} ${p.receipt_number ?? ''}`} title={t('billing.printReceipt')} onClick={() => openPdf(`/payments/${p.id}/receipt`)}>
                          <Printer />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {!!invoice.credit_notes?.length && (
            <Card>
              <CardHeader title={t('billing.creditNotes')} />
              <CardContent>
                <ul className="divide-y divide-border text-sm">
                  {invoice.credit_notes.map((c) => (
                    <li key={c.id} className="flex justify-between gap-3 py-2.5">
                      <div>
                        <p className="tabular font-medium">{c.number}</p>
                        <p className="text-xs text-fg-muted">{c.reason} · {f.instant(c.issued_at, 'd MMM yyyy')}</p>
                      </div>
                      <span className="tabular font-semibold">− {f.money(c.amount_minor)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {invoice.payer_type === 'insurance' && (
            <Card>
              <CardHeader title={t('billing.claim')} />
              <CardContent className="text-sm">
                {invoice.claim_status ? <StatusBadge status={invoice.claim_status} /> : '—'} {invoice.claim_reference && <span className="ms-2 text-fg-muted">{invoice.claim_reference}</span>}
              </CardContent>
            </Card>
          )}
          {invoice.notes && (
            <Card>
              <CardHeader title={t('billing.notes')} />
              <CardContent className="whitespace-pre-line text-sm">{invoice.notes}</CardContent>
            </Card>
          )}
        </div>
      </div>

      {dialog === 'edit' && <InvoiceEditor invoice={invoice} onClose={() => setDialog(null)} />}
      {dialog === 'pay' && <PaymentDialog invoice={invoice} onDone={(inv) => { setDialog(null); refresh(inv); }} onClose={() => setDialog(null)} />}
      {dialog === 'refund' && <RefundDialog invoice={invoice} onDone={(inv) => { setDialog(null); refresh(inv); }} onClose={() => setDialog(null)} />}
      {dialog === 'credit' && <CreditDialog invoice={invoice} onDone={(inv) => { setDialog(null); refresh(inv); }} onClose={() => setDialog(null)} />}
      {dialog === 'void' && <VoidDialog invoice={invoice} onDone={(inv) => { setDialog(null); refresh(inv); }} onClose={() => setDialog(null)} />}
      {dialog === 'claim' && <ClaimDialog invoice={invoice} onDone={(inv) => { setDialog(null); refresh(inv); }} onClose={() => setDialog(null)} />}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'border-t border-border pt-2 text-base font-bold' : ''}`}>
      <dt className={strong ? '' : 'text-fg-muted'}>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

interface ActionDialogProps {
  invoice: Invoice;
  onDone: (invoice: Invoice) => void;
  onClose: () => void;
}

function ActionDialog({ title, children, busy, onSubmit, onClose, error, submitLabel, danger }: { title: string; children: ReactNode; busy: boolean; onSubmit: () => void; onClose: () => void; error: string | null; submitLabel: string; danger?: boolean }) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="sm"
        title={title}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onSubmit}>{submitLabel}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const METHODS: PaymentMethodCode[] = ['upi', 'cash', 'card', 'bank_transfer', 'insurance'];

function PaymentDialog({ invoice, onDone, onClose }: ActionDialogProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const [amount, setAmount] = useState<number | null>(Math.max(0, invoice.balance_minor));
  const [method, setMethod] = useState<PaymentMethodCode>('upi');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => unwrap(api.POST('/invoices/{invoice}/payments', { params: { path: { invoice: invoice.id } }, body: { amount_minor: amount ?? 0, method, reference: reference || null } as never })),
    onSuccess: (r) => {
      toast.success(t('billing.paymentRecorded'));
      onDone((r as unknown as { invoice: Invoice }).invoice);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <ActionDialog title={t('billing.recordPayment')} busy={m.isPending} onSubmit={() => m.mutate()} onClose={onClose} error={error} submitLabel={t('billing.recordPayment')}>
      <p className="text-sm text-fg-muted">{t('billing.balance')}: <span className="tabular font-semibold text-fg">{f.money(invoice.balance_minor)}</span></p>
      <Field label={t('billing.amount')} required>
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <Field label={t('billing.method')}>
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodCode)}>
          {METHODS.map((x) => <option key={x} value={x}>{t(`common:paymentMethod.${x}`)}</option>)}
        </Select>
      </Field>
      <Field label={t('billing.reference')}>
        <Input value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>
    </ActionDialog>
  );
}

function RefundDialog({ invoice, onDone, onClose }: ActionDialogProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<number | null>(invoice.amount_paid_minor);
  const [method, setMethod] = useState<PaymentMethodCode>('cash');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => unwrap(api.POST('/invoices/{invoice}/refunds', { params: { path: { invoice: invoice.id } }, body: { amount_minor: amount ?? 0, method, reason } as never })),
    onSuccess: (r) => {
      toast.success(t('billing.refunded'));
      onDone((r as unknown as { invoice: Invoice }).invoice);
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <ActionDialog title={t('billing.refund')} busy={m.isPending} onSubmit={() => m.mutate()} onClose={onClose} error={error} submitLabel={t('billing.refund')} danger>
      <Field label={t('billing.amount')} required><MoneyInput value={amount} onChange={setAmount} /></Field>
      <Field label={t('billing.method')}>
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodCode)}>
          {METHODS.map((x) => <option key={x} value={x}>{t(`common:paymentMethod.${x}`)}</option>)}
        </Select>
      </Field>
      <Field label={t('billing.refundReason')} required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </ActionDialog>
  );
}

function CreditDialog({ invoice, onDone, onClose }: ActionDialogProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<number | null>(invoice.total_minor - invoice.amount_credited_minor);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => unwrap(api.POST('/invoices/{invoice}/credit-notes', { params: { path: { invoice: invoice.id } }, body: { amount_minor: amount ?? 0, reason } as never })),
    onSuccess: (r) => {
      toast.success(t('billing.credited'));
      onDone((r as unknown as { data: Invoice }).data);
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <ActionDialog title={t('billing.creditNote')} busy={m.isPending} onSubmit={() => m.mutate()} onClose={onClose} error={error} submitLabel={t('billing.creditNote')}>
      <Field label={t('billing.creditAmount')} required><MoneyInput value={amount} onChange={setAmount} /></Field>
      <Field label={t('billing.creditReason')} required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </ActionDialog>
  );
}

function VoidDialog({ invoice, onDone, onClose }: ActionDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => unwrap(api.POST('/invoices/{invoice}/void', { params: { path: { invoice: invoice.id } }, body: { reason } })),
    onSuccess: (r) => {
      toast.success(t('billing.voided'));
      onDone((r as unknown as { data: Invoice }).data);
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <ActionDialog title={t('billing.void')} busy={m.isPending} onSubmit={() => m.mutate()} onClose={onClose} error={error} submitLabel={t('billing.void')} danger>
      <Field label={t('billing.voidReason')} required><Textarea rows={2} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </ActionDialog>
  );
}

function ClaimDialog({ invoice, onDone, onClose }: ActionDialogProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState(invoice.claim_status ?? 'submitted');
  const [ref, setRef] = useState(invoice.claim_reference ?? '');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => unwrap(api.PUT('/invoices/{invoice}/claim', { params: { path: { invoice: invoice.id } }, body: { claim_status: status, claim_reference: ref || null } as never })),
    onSuccess: (r) => {
      toast.success(t('billing.claimUpdated'));
      onDone((r as unknown as { data: Invoice }).data);
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <ActionDialog title={t('billing.claim')} busy={m.isPending} onSubmit={() => m.mutate()} onClose={onClose} error={error} submitLabel={t('common:actions.save')}>
      <Field label={t('billing.claimStatus')}>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          {['submitted', 'approved', 'rejected', 'settled'].map((s) => <option key={s} value={s}>{t(`billing.claimStatuses.${s}`)}</option>)}
        </Select>
      </Field>
      <Field label={t('billing.claimRef')}><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
    </ActionDialog>
  );
}
