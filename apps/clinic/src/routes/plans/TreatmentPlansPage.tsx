import { api, unwrap, type TreatmentPlan } from '@physio/api';
import { Badge, Card, EmptyState, PageHeader, Pagination, ProgressBar, SearchInput, Select, Skeleton, Table, Td, Th, Tr } from '@physio/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useStaff } from '../../lib/catalog';
import { useFormat } from '../../lib/format';
import { useDebounced, useUrlState } from '../../lib/hooks';

export function TreatmentPlansPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const [status, setStatus] = useUrlState('status', 'active');
  const [practitioner, setPractitioner] = useUrlState('practitioner');
  const [page, setPage] = useUrlState('page', '1');
  const [text, setText] = useState('');
  const search = useDebounced(text, 300);
  const { data: practitioners } = useStaff({ practitionersOnly: true });

  const { data, isLoading } = useQuery({
    queryKey: ['treatment-plans', { status, practitioner, search, page }],
    queryFn: () =>
      unwrap(
        api.GET('/treatment-plans', {
          params: { query: { status: status === 'all' ? undefined : status, practitioner_id: practitioner ? Number(practitioner) : undefined, search: search || undefined, page: Number(page) } as never },
        }),
      ) as unknown as Promise<{ data: TreatmentPlan[]; meta: { current_page: number; last_page: number; total: number } }>,
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader title={t('plans.title')} description={t('plans.subtitle')} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <SearchInput className="min-w-60 flex-1" placeholder={`${t('plans.planTitle')} / ${t('appointments.patient')}`} aria-label={t('common:actions.search')} value={text} onChange={(e) => setText(e.target.value)} />
          <Select aria-label={t('plans.status')} className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t('billing.all')}</option>
            {['active', 'draft', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{t(`plans.statuses.${s}`)}</option>)}
          </Select>
          <Select aria-label={t('appointments.practitioner')} className="w-52" value={practitioner} onChange={(e) => setPractitioner(e.target.value)}>
            <option value="">{t('appointments.allPractitioners')}</option>
            {practitioners?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.data.length ? (
          <EmptyState icon={<ClipboardList />} title={t('plans.noPlans')} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>{t('plans.planTitle')}</Th>
                  <Th>{t('appointments.patient')}</Th>
                  <Th>{t('appointments.practitioner')}</Th>
                  <Th>{t('plans.startDate')}</Th>
                  <Th className="w-56">{t('plans.duration')}</Th>
                  <Th>{t('plans.status')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => (
                  <Tr key={p.id} interactive onClick={() => navigate(`/treatment-plans/${p.id}`)}>
                    <Td className="font-semibold">{p.title}<div className="text-xs font-normal text-fg-muted">{t('plans.exercises', { count: p.exercises_count ?? 0 })}</div></Td>
                    <Td>{p.patient?.full_name}<div className="text-xs text-fg-muted">{p.patient?.mrn}</div></Td>
                    <Td>{p.practitioner?.name}</Td>
                    <Td className="whitespace-nowrap">{f.local(p.start_date)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={(p.current_week / p.duration_weeks) * 100} label={t('plans.weekOf', { current: p.current_week, total: p.duration_weeks })} />
                        <span className="shrink-0 text-xs text-fg-muted">{p.current_week}/{p.duration_weeks}</span>
                      </div>
                    </Td>
                    <Td><Badge tone={p.status === 'active' ? 'success' : 'neutral'}>{t(`plans.statuses.${p.status}`)}</Badge></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={(p) => setPage(String(p))} labels={{ previous: t('common:pagination.previous'), next: t('common:pagination.next'), page: (pg, tot) => t('common:pagination.page', { page: pg, total: tot }) }} />
          </>
        )}
      </Card>
    </div>
  );
}
