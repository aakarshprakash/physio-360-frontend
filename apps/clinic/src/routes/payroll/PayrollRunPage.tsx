import { api, unwrap, type PayLine, type PayrollRun, type Payslip } from '@physio/api';
import { Alert, Avatar, Button, Card, ConfirmDialog, Dialog, DialogContent, ErrorState, Field, Input, PageHeader, PageLoader, StatCard, Table, Td, Th, toast, Tr } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, CalendarDays, CheckCheck, Download, Pencil, RefreshCw, Trash2, Users, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { StatusBadge } from '../../components/common';
import { toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { openPdf } from '../../lib/pdf';
import { PayLinesEditor } from './PayLinesEditor';
import { periodLabel } from './PayrollPage';

interface Response {
  data: PayrollRun;
  staff_without_salary: { id: number; name: string }[];
}

export function PayrollRunPage() {
  const { t, i18n } = useTranslation();
  const f = useFormat();
  const { runId } = useParams();
  const id = Number(runId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adjusting, setAdjusting] = useState<Payslip | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['payroll', 'run', id],
    queryFn: () => unwrap(api.GET('/payroll/runs/{run}', { params: { path: { run: id } } })) as unknown as Promise<Response>,
  });

  const action = useMutation({
    mutationFn: (kind: 'recalculate' | 'finalize' | 'mark-paid' | 'delete') => {
      const path = { params: { path: { run: id } } };
      if (kind === 'recalculate') return unwrap(api.POST('/payroll/runs/{run}/recalculate', path));
      if (kind === 'finalize') return unwrap(api.POST('/payroll/runs/{run}/finalize', path));
      if (kind === 'mark-paid') return unwrap(api.POST('/payroll/runs/{run}/mark-paid', path));
      return unwrap(api.DELETE('/payroll/runs/{run}', path));
    },
    onSuccess: (_r, kind) => {
      toast.success(t({ recalculate: 'payroll.recalculated', finalize: 'payroll.finalized', 'mark-paid': 'payroll.paid', delete: 'payroll.deleted' }[kind]));
      void queryClient.invalidateQueries({ queryKey: ['payroll'] });
      if (kind === 'delete') navigate('/payroll');
    },
    onError: toastError,
  });

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState title={t('common:errors.notFound')} action={<Button asChild variant="outline"><Link to="/payroll">{t('payroll.back')}</Link></Button>} />;

  const run = data.data;
  const draft = run.status === 'draft';

  return (
    <div className="space-y-5">
      <Link to="/payroll" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t('payroll.back')}
      </Link>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{t('payroll.title')} · {periodLabel(run.period, i18n.language)} <StatusBadge status={run.status} /></span>}
        description={t('payroll.lopHint')}
        actions={
          <>
            {draft && (
              <>
                <ConfirmDialog tone="danger" title={t('payroll.deleteRun')} description={t('payroll.deleteConfirm')} confirmLabel={t('payroll.deleteRun')} cancelLabel={t('common:actions.cancel')} onConfirm={() => action.mutateAsync('delete')}
                  trigger={<Button variant="danger-ghost"><Trash2 />{t('payroll.deleteRun')}</Button>} />
                <ConfirmDialog title={t('payroll.recalculate')} description={t('payroll.recalculateConfirm')} confirmLabel={t('payroll.recalculate')} cancelLabel={t('common:actions.cancel')} onConfirm={() => action.mutateAsync('recalculate')}
                  trigger={<Button variant="outline"><RefreshCw />{t('payroll.recalculate')}</Button>} />
                <ConfirmDialog title={t('payroll.finalize')} description={t('payroll.finalizeConfirm')} confirmLabel={t('payroll.finalize')} cancelLabel={t('common:actions.cancel')} onConfirm={() => action.mutateAsync('finalize')}
                  trigger={<Button><BadgeCheck />{t('payroll.finalize')}</Button>} />
              </>
            )}
            {run.status === 'finalized' && (
              <ConfirmDialog title={t('payroll.markPaid')} description={t('payroll.markPaidConfirm')} confirmLabel={t('payroll.markPaid')} cancelLabel={t('common:actions.cancel')} onConfirm={() => action.mutateAsync('mark-paid')}
                trigger={<Button><CheckCheck />{t('payroll.markPaid')}</Button>} />
            )}
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('payroll.title')}>
        <StatCard label={t('payroll.employees')} value={run.payslips?.length ?? 0} icon={<Users />} tone="info" />
        <StatCard label={t('payroll.workingDays')} value={run.working_days} icon={<CalendarDays />} tone="violet" />
        <StatCard label={t('payroll.gross')} value={f.money(run.total_gross_minor)} icon={<Wallet />} tone="warning" />
        <StatCard label={t('payroll.totalNet')} value={f.money(run.total_net_minor)} icon={<BadgeCheck />} tone="primary" />
      </section>

      {draft && data.staff_without_salary.length > 0 && (
        <Alert tone="warning">
          {t('payroll.missingSalary', { names: data.staff_without_salary.map((s) => s.name).join(', ') })}{' '}
          <Link to="/payroll?tab=salaries" className="font-semibold underline">{t('payroll.setSalary')}</Link>
        </Alert>
      )}

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t('payroll.employee')}</Th>
              <Th className="text-end">{t('payroll.paidDays')}</Th>
              <Th className="text-end">{t('payroll.lopDays')}</Th>
              <Th className="text-end">{t('payroll.gross')}</Th>
              <Th className="text-end">{t('payroll.deductions')}</Th>
              <Th className="text-end">{t('payroll.net')}</Th>
              <Th><span className="sr-only">{t('common:actions.more')}</span></Th>
            </tr>
          </thead>
          <tbody>
            {run.payslips?.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={p.user?.name ?? ''} color={p.user?.color} size={30} />
                    <span className="min-w-0">
                      <span className="block max-w-48 truncate font-medium">{p.user?.name}</span>
                      {p.notes && <span className="block max-w-48 truncate text-xs text-fg-muted">{p.notes}</span>}
                    </span>
                  </span>
                </Td>
                <Td className="tabular text-end">{p.paid_days} / {p.working_days}</Td>
                <Td className={p.lop_days > 0 ? 'tabular text-end font-semibold text-danger' : 'tabular text-end text-fg-muted'}>{p.lop_days}</Td>
                <Td className="tabular text-end">{f.money(p.gross_minor)}</Td>
                <Td className="tabular text-end text-fg-muted">{f.money(p.total_deductions_minor)}</Td>
                <Td className="tabular text-end font-semibold">{f.money(p.net_minor)}</Td>
                <Td className="whitespace-nowrap text-end">
                  {draft && <Button size="sm" variant="ghost" onClick={() => setAdjusting(p)}><Pencil />{t('payroll.adjust')}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => openPdf(`/payslips/${p.id}/pdf`)}><Download />{t('payroll.payslip')}</Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {adjusting && <AdjustDialog payslip={adjusting} runId={id} onClose={() => setAdjusting(null)} />}
    </div>
  );
}

function AdjustDialog({ payslip, runId, onClose }: { payslip: Payslip; runId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const queryClient = useQueryClient();
  const [earnings, setEarnings] = useState<PayLine[]>(payslip.earnings);
  const [deductions, setDeductions] = useState<PayLine[]>(payslip.deductions);
  const [notes, setNotes] = useState(payslip.notes ?? '');
  const sum = (lines: PayLine[]) => lines.reduce((s, l) => s + (l.amount_minor || 0), 0);

  const save = useMutation({
    mutationFn: () =>
      unwrap(api.PUT('/payslips/{payslip}', {
        params: { path: { payslip: payslip.id } },
        body: { earnings: earnings.filter((l) => l.name.trim()), deductions: deductions.filter((l) => l.name.trim()), notes: notes || null } as never,
      })),
    onSuccess: () => {
      toast.success(t('payroll.adjusted'));
      void queryClient.invalidateQueries({ queryKey: ['payroll', 'run', runId] });
      onClose();
    },
    onError: toastError,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={t('payroll.adjustTitle', { name: payslip.user?.name })}
        closeLabel={t('common:actions.close')}
        footer={
          <>
            <span className="me-auto text-sm">
              {t('payroll.net')}: <strong className="tabular">{f.money(sum(earnings) - sum(deductions))}</strong>
            </span>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>{t('common:actions.save')}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <PayLinesEditor legend={t('payroll.earnings')} lines={earnings} onChange={setEarnings} addLabel={t('payroll.addEarning')} placeholder={t('payroll.lineName')} />
          <PayLinesEditor legend={t('payroll.deductions')} lines={deductions} onChange={setDeductions} addLabel={t('payroll.addDeduction')} placeholder={t('payroll.lineName')} />
          <Field label={t('payroll.payslipNotes')}><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
