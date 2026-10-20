import { api, unwrap, type PackageRow, type PageMeta } from '@physio/api';
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Pagination, ProgressBar, SearchInput, Segmented, Skeleton, StatCard, Table, Td, Th, Tr } from '@physio/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlarmClock, Layers, Package, Plus, Settings2, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { StatusBadge } from '../../components/common';
import { useFormat } from '../../lib/format';
import { useDebounced, useUrlState } from '../../lib/hooks';
import { useSession } from '../../lib/session';

interface Response {
  data: PackageRow[];
  meta: PageMeta;
  summary: { active: number; expiring_14d: number; sessions_remaining: number; sold_30d: number };
}

const FILTERS = ['all', 'active', 'expiring', 'exhausted', 'expired'] as const;

export function PackagesPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = useSession();
  const [status, setStatus] = useUrlState('status', 'all');
  const [page, setPage] = useUrlState('page', '1');
  const [text, setText] = useState('');
  const search = useDebounced(text, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['packages', { status, page, search }],
    queryFn: () =>
      unwrap(api.GET('/packages', { params: { query: { status: status === 'all' ? undefined : status, search: search || undefined, page: Number(page) } as never } })) as unknown as Promise<Response>,
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title={t('packages.title')}
        description={t('packages.subtitle')}
        actions={
          <>
            {can('settings.manage') && (
              <Button variant="outline" asChild>
                <Link to="/settings?section=packages"><Settings2 />{t('packages.plans')}</Link>
              </Button>
            )}
            {can('billing.manage') && (
              <Button asChild>
                <Link to="/billing?new=1"><Plus />{t('packages.sell')}</Link>
              </Button>
            )}
          </>
        }
      />

      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('packages.title')}>
        {data ? (
          <>
            <StatCard label={t('packages.summary.active')} value={data.summary.active} icon={<Package />} tone="primary" />
            <StatCard label={t('packages.summary.expiring')} value={data.summary.expiring_14d} icon={<AlarmClock />} tone="warning" />
            <StatCard label={t('packages.summary.sessions')} value={f.number(data.summary.sessions_remaining)} icon={<Layers />} tone="info" />
            <StatCard label={t('packages.summary.sold')} value={data.summary.sold_30d} icon={<ShoppingBag />} tone="violet" />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        )}
      </section>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Segmented label={t('packages.title')} value={status as (typeof FILTERS)[number]} onChange={setStatus} options={FILTERS.map((x) => ({ value: x, label: t(`packages.filters.${x}`) }))} />
          <SearchInput className="min-w-52 flex-1" placeholder={`${t('packages.patient')} / ${t('packages.package')}`} aria-label={t('common:actions.search')} value={text} onChange={(e) => setText(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.data.length ? (
          <EmptyState icon={<Package />} title={t('packages.empty')} description={t('packages.emptyHint')} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>{t('packages.patient')}</Th>
                  <Th>{t('packages.package')}</Th>
                  <Th className="w-56">{t('packages.sessions')}</Th>
                  <Th>{t('packages.purchased')}</Th>
                  <Th>{t('packages.expires')}</Th>
                  <Th>{t('billing.status')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => {
                  const used = p.sessions_total - p.sessions_remaining;
                  return (
                    <Tr key={p.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={p.patient.full_name} size={32} />
                          <div className="min-w-0">
                            <Link to={`/patients/${p.patient.id}?tab=billing`} className="block max-w-48 truncate font-semibold hover:underline">{p.patient.full_name}</Link>
                            <span className="text-xs text-fg-muted">{p.patient.mrn}</span>
                          </div>
                        </div>
                      </Td>
                      <Td className="font-medium">{p.name}</Td>
                      <Td>
                        <p className="mb-1 text-[13px]">{t('packages.remaining', { remaining: p.sessions_remaining, total: p.sessions_total })}</p>
                        <ProgressBar value={p.sessions_total ? (used / p.sessions_total) * 100 : 0} label={t('packages.remaining', { remaining: p.sessions_remaining, total: p.sessions_total })} />
                      </Td>
                      <Td className="whitespace-nowrap text-fg-muted">{f.local(p.purchased_on)}</Td>
                      <Td className="whitespace-nowrap">
                        {p.expires_on ? (
                          <span className={p.expiring_soon ? 'font-semibold text-warning-soft-fg' : ''}>
                            {f.local(p.expires_on)}
                            {p.expiring_soon && <Badge tone="warning" className="ms-2">{t('packages.expiringSoon')}</Badge>}
                          </span>
                        ) : (
                          <span className="text-fg-subtle">{t('packages.noExpiry')}</span>
                        )}
                      </Td>
                      <Td><StatusBadge status={p.status} /></Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination
              page={data.meta.current_page}
              lastPage={data.meta.last_page}
              total={data.meta.total}
              onChange={(pg) => setPage(String(pg))}
              labels={{ previous: t('common:pagination.previous'), next: t('common:pagination.next'), page: (pg, tot) => t('common:pagination.page', { page: pg, total: tot }) }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
