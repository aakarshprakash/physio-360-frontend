import { api, unwrap, type PayLine, type PayrollRun, type Payslip, type SalaryRow } from '@physio/api';
import { formatLocal, todayInZone } from '@physio/core';
import { Avatar, Button, Card, Dialog, DialogContent, EmptyState, Field, Input, PageHeader, Skeleton, Table, Tabs, TabsContent, TabsList, TabsTrigger, Td, Th, toast, Tr } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Pencil, Play, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { MoneyInput, StatusBadge } from '../../components/common';
import { handleFormError, toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useUrlState } from '../../lib/hooks';
import { openPdf } from '../../lib/pdf';
import { useSession } from '../../lib/session';
import { PayLinesEditor } from './PayLinesEditor';

export function PayrollPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const manager = can('payroll.manage');
  const [tab, setTab] = useUrlState('tab', manager ? 'runs' : 'mine');
  const [running, setRunning] = useState(false);

  return (
    <div>
      <PageHeader
        title={t('payroll.title')}
        description={t('payroll.subtitle')}
        actions={manager && <Button onClick={() => setRunning(true)}><Play className="rtl:-scale-x-100" />{t('payroll.newRun')}</Button>}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label={t('payroll.title')}>
          {manager && <TabsTrigger value="runs">{t('payroll.runs')}</TabsTrigger>}
          {manager && <TabsTrigger value="salaries">{t('payroll.salaries')}</TabsTrigger>}
          <TabsTrigger value="mine">{t('payroll.myPayslips')}</TabsTrigger>
        </TabsList>
        <div className="pt-5">
          {manager && <TabsContent value="runs">{tab === 'runs' && <Runs />}</TabsContent>}
          {manager && <TabsContent value="salaries">{tab === 'salaries' && <Salaries />}</TabsContent>}
          <TabsContent value="mine">{tab === 'mine' && <MyPayslips />}</TabsContent>
        </div>
      </Tabs>
      {running && <NewRunDialog onClose={() => setRunning(false)} />}
    </div>
  );
}

export function periodLabel(period: string, lang: string): string {
  return formatLocal(`${period}-01`, 'MMMM yyyy', lang);
}

function Runs() {
  const { t, i18n } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['payroll', 'runs'],
    queryFn: async () => (await unwrap(api.GET('/payroll/runs'))).data as PayrollRun[],
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!data?.length) return <Card><EmptyState icon={<Wallet />} title={t('payroll.noRuns')} description={t('payroll.noRunsHint')} /></Card>;

  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>{t('payroll.period')}</Th>
            <Th>{t('payroll.status')}</Th>
            <Th className="text-end">{t('payroll.employees')}</Th>
            <Th className="text-end">{t('payroll.workingDays')}</Th>
            <Th className="text-end">{t('payroll.gross')}</Th>
            <Th className="text-end">{t('payroll.deductions')}</Th>
            <Th className="text-end">{t('payroll.totalNet')}</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <Tr key={r.id} interactive onClick={() => navigate(`/payroll/${r.id}`)}>
              <Td><Link to={`/payroll/${r.id}`} className="font-semibold hover:underline">{periodLabel(r.period, i18n.language)}</Link></Td>
              <Td><StatusBadge status={r.status} /></Td>
              <Td className="tabular text-end">{r.payslips_count}</Td>
              <Td className="tabular text-end">{r.working_days}</Td>
              <Td className="tabular text-end">{f.money(r.total_gross_minor)}</Td>
              <Td className="tabular text-end text-fg-muted">{f.money(r.total_deductions_minor)}</Td>
              <Td className="tabular text-end font-semibold">{f.money(r.total_net_minor)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function Salaries() {
  const { t } = useTranslation();
  const f = useFormat();
  const [editing, setEditing] = useState<SalaryRow | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['payroll', 'salaries'],
    queryFn: async () => (await unwrap(api.GET('/payroll/salaries'))).data as unknown as SalaryRow[],
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>{t('payroll.employee')}</Th>
            <Th className="text-end">{t('payroll.basic')}</Th>
            <Th className="text-end">{t('payroll.monthlyGross')}</Th>
            <Th className="text-end">{t('payroll.monthlyNet')}</Th>
            <Th>{t('payroll.effectiveFrom')}</Th>
            <Th><span className="sr-only">{t('common:actions.edit')}</span></Th>
          </tr>
        </thead>
        <tbody>
          {data?.map((row) => (
            <Tr key={row.user.id}>
              <Td>
                <span className="flex items-center gap-2.5">
                  <Avatar name={row.user.name} color={row.user.color} size={30} />
                  <span className="min-w-0">
                    <span className="block max-w-48 truncate font-medium">{row.user.name}</span>
                    {row.user.title && <span className="block max-w-48 truncate text-xs text-fg-muted">{row.user.title}</span>}
                  </span>
                </span>
              </Td>
              {row.salary ? (
                <>
                  <Td className="tabular text-end">{f.money(row.salary.basic_minor)}</Td>
                  <Td className="tabular text-end">{f.money(row.salary.monthly_gross_minor)}</Td>
                  <Td className="tabular text-end font-semibold">{f.money(row.salary.monthly_net_minor)}</Td>
                  <Td className="whitespace-nowrap text-fg-muted">{f.local(row.salary.effective_from)}</Td>
                </>
              ) : (
                <Td colSpan={4} className="text-fg-subtle">{t('payroll.notSet')}</Td>
              )}
              <Td className="text-end">
                <Button size="sm" variant={row.salary ? 'ghost' : 'secondary'} onClick={() => setEditing(row)}>
                  <Pencil />
                  {row.salary ? t('common:actions.edit') : t('payroll.setSalary')}
                </Button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {editing && <SalaryDialog row={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function SalaryDialog({ row, onClose }: { row: SalaryRow; onClose: () => void }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [basic, setBasic] = useState<number | null>(row.salary?.basic_minor ?? null);
  const [allowances, setAllowances] = useState<PayLine[]>(row.salary?.allowances ?? [{ name: 'HRA', amount_minor: 0 }]);
  const [deductions, setDeductions] = useState<PayLine[]>(row.salary?.deductions ?? []);
  const [form, setForm] = useState({
    effective_from: row.salary?.effective_from ?? todayInZone(session.tenant.timezone),
    bank_account: row.salary?.bank_account ?? '',
    tax_id: row.salary?.tax_id ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      unwrap(api.PUT('/payroll/salaries/{user}', {
        params: { path: { user: row.user.id } },
        body: {
          basic_minor: basic ?? 0,
          allowances: allowances.filter((l) => l.name.trim()),
          deductions: deductions.filter((l) => l.name.trim()),
          effective_from: form.effective_from,
          bank_account: form.bank_account || null,
          tax_id: form.tax_id || null,
        } as never,
      })),
    onSuccess: () => {
      toast.success(t('payroll.salarySaved'));
      void queryClient.invalidateQueries({ queryKey: ['payroll', 'salaries'] });
      onClose();
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={t('payroll.editSalary', { name: row.user.name })}
        closeLabel={t('common:actions.close')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>{t('common:actions.save')}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('payroll.basic')} required error={errors.basic_minor}><MoneyInput value={basic} onChange={setBasic} /></Field>
            <Field label={t('payroll.effectiveFrom')} required error={errors.effective_from}><Input type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} /></Field>
          </div>
          <PayLinesEditor legend={t('payroll.allowances')} lines={allowances} onChange={setAllowances} addLabel={t('payroll.addEarning')} placeholder={t('payroll.allowance')} />
          <PayLinesEditor legend={t('payroll.fixedDeductions')} lines={deductions} onChange={setDeductions} addLabel={t('payroll.addDeduction')} placeholder={t('payroll.deduction')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('payroll.bankAccount')}><Input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} /></Field>
            <Field label={t('payroll.taxId')}><Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} /></Field>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MyPayslips() {
  const { t, i18n } = useTranslation();
  const f = useFormat();
  const { data, isLoading } = useQuery({
    queryKey: ['payroll', 'mine'],
    queryFn: async () => (await unwrap(api.GET('/payroll/my-payslips'))).data as Payslip[],
  });

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (!data?.length) return <Card><EmptyState icon={<FileSpreadsheet />} title={t('payroll.noPayslips')} description={t('payroll.noPayslipsHint')} /></Card>;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{p.period ? periodLabel(p.period, i18n.language) : ''}</p>
              <p className="text-xs text-fg-muted">{t('payroll.paidDays')}: {p.paid_days} / {p.working_days}</p>
            </div>
            {p.run_status && <StatusBadge status={p.run_status} />}
          </div>
          <p className="mt-3 text-xs text-fg-muted">{t('payroll.net')}</p>
          <p className="tabular text-2xl font-bold">{f.money(p.net_minor)}</p>
          <p className="tabular text-xs text-fg-muted">{t('payroll.gross')} {f.money(p.gross_minor)} · {t('payroll.deductions')} {f.money(p.total_deductions_minor)}</p>
          <Button className="mt-3 w-full" variant="outline" size="sm" onClick={() => openPdf(`/payslips/${p.id}/pdf`)}>
            <Download />
            {t('payroll.download')}
          </Button>
        </Card>
      ))}
    </div>
  );
}

function NewRunDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = todayInZone(session.tenant.timezone);
  const [y, m] = now.split('-').map(Number);
  const previous = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const [period, setPeriod] = useState(previous);

  const create = useMutation({
    mutationFn: () => unwrap(api.POST('/payroll/runs', { body: { period } as never })),
    onSuccess: (r) => {
      const run = (r as unknown as { data: PayrollRun }).data;
      toast.success(t('payroll.runCreated', { period: periodLabel(run.period, i18n.language) }));
      void queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      navigate(`/payroll/${run.id}`);
    },
    onError: toastError,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="sm"
        title={t('payroll.newRun')}
        description={t('payroll.lopHint')}
        closeLabel={t('common:actions.close')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={create.isPending} disabled={!period} onClick={() => create.mutate()}>{t('payroll.newRun')}</Button>
          </>
        }
      >
        <Field label={t('payroll.period')} required><Input type="month" max={now.slice(0, 7)} value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
      </DialogContent>
    </Dialog>
  );
}
