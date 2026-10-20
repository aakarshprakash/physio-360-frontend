import { api, ENQUIRY_SOURCES, unwrap, type Enquiry } from '@physio/api';
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Pagination, SearchInput, Segmented, Select, Skeleton, StatCard, Table, Td, Th, Tr } from '@physio/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlarmClock, Inbox, Percent, Plus, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { StatusBadge } from '../../components/common';
import { useStaff } from '../../lib/catalog';
import { useFormat } from '../../lib/format';
import { useDebounced, useUrlState } from '../../lib/hooks';
import { useSession } from '../../lib/session';
import { EnquiryDrawer } from './EnquiryDrawer';
import { EnquiryFormDialog } from './EnquiryFormDialog';

interface Summary {
  by_status: Record<string, number>;
  open: number;
  due_today: number;
  received_30d: number;
  converted_30d: number;
  conversion_rate_30d: number;
}

export function EnquiriesPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const { branchId } = useSession();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useUrlState('status', 'open');
  const [source, setSource] = useUrlState('source');
  const [assignee, setAssignee] = useUrlState('assigned');
  const [page, setPage] = useUrlState('page', '1');
  const [text, setText] = useState('');
  const search = useDebounced(text, 300);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const openId = params.get('open') ? Number(params.get('open')) : null;
  const { data: staff } = useStaff();

  const setOpen = (id: number | null) =>
    setParams((p) => {
      if (id) p.set('open', String(id));
      else p.delete('open');
      p.delete('new');
      return p;
    }, { replace: true });

  const { data, isLoading } = useQuery({
    queryKey: ['enquiries', { status, source, assignee, page, search, branchId }],
    queryFn: () =>
      unwrap(
        api.GET('/enquiries', {
          params: {
            query: {
              status: status === 'all' ? undefined : status,
              source: source || undefined,
              assigned_to: assignee ? Number(assignee) : undefined,
              branch_id: branchId ?? undefined,
              search: search || undefined,
              page: Number(page),
            } as never,
          },
        }),
      ) as unknown as Promise<{ data: Enquiry[]; meta: { current_page: number; last_page: number; total: number }; summary: Summary }>,
    placeholderData: keepPreviousData,
  });
  const summary = data?.summary;

  return (
    <div>
      <PageHeader
        title={t('enquiries.title')}
        description={t('enquiries.subtitle')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            {t('enquiries.new')}
          </Button>
        }
      />

      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('enquiries.title')}>
        {summary ? (
          <>
            <StatCard label={t('enquiries.summary.open')} value={summary.open} icon={<Inbox />} tone="info" />
            <StatCard label={t('enquiries.summary.due')} value={summary.due_today} icon={<AlarmClock />} tone="warning" />
            <StatCard label={t('enquiries.summary.received')} value={summary.received_30d} icon={<TrendingUp />} tone="primary" />
            <StatCard label={t('enquiries.summary.conversion')} value={`${summary.conversion_rate_30d}%`} icon={<Percent />} tone="violet" />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        )}
      </section>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Segmented
            label={t('enquiries.status')}
            value={['open', 'due', 'all'].includes(status) ? status : 'all'}
            onChange={setStatus}
            options={[
              { value: 'open', label: t('enquiries.filters.open') },
              { value: 'due', label: `${t('enquiries.filters.due')}${summary?.due_today ? ` (${summary.due_today})` : ''}` },
              { value: 'all', label: t('enquiries.filters.all') },
            ]}
          />
          <SearchInput className="min-w-52 flex-1" placeholder={`${t('enquiries.name')} / ${t('enquiries.phone')}`} aria-label={t('common:actions.search')} value={text} onChange={(e) => setText(e.target.value)} />
          <Select aria-label={t('enquiries.status')} className="w-40" value={['open', 'due', 'all'].includes(status) ? '' : status} onChange={(e) => setStatus(e.target.value || 'all')}>
            <option value="">{t('enquiries.status')}</option>
            {['new', 'contacted', 'follow_up', 'converted', 'lost'].map((s) => <option key={s} value={s}>{t(`common:status.${s}`, { defaultValue: s })}</option>)}
          </Select>
          <Select aria-label={t('enquiries.source')} className="w-40" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">{t('enquiries.source')}</option>
            {ENQUIRY_SOURCES.map((s) => <option key={s} value={s}>{t(`enquiries.sources.${s}`)}</option>)}
          </Select>
          <Select aria-label={t('enquiries.assignedTo')} className="w-44" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">{t('enquiries.assignedTo')}</option>
            {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.data.length ? (
          <EmptyState icon={<Inbox />} title={t('enquiries.empty')} description={t('enquiries.emptyHint')} action={<Button onClick={() => setCreating(true)}>{t('enquiries.new')}</Button>} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>{t('enquiries.name')}</Th>
                  <Th>{t('enquiries.interest')}</Th>
                  <Th>{t('enquiries.source')}</Th>
                  <Th>{t('enquiries.assignedTo')}</Th>
                  <Th>{t('enquiries.nextFollowUp')}</Th>
                  <Th>{t('enquiries.received')}</Th>
                  <Th>{t('enquiries.status')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((e) => (
                  <Tr key={e.id} interactive onClick={() => setOpen(e.id)}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={e.name} size={32} />
                        <div className="min-w-0">
                          <button type="button" className="block max-w-56 cursor-pointer truncate text-start font-semibold hover:underline" onClick={() => setOpen(e.id)}>
                            {e.name}
                          </button>
                          <span dir="ltr" className="tabular text-xs text-fg-muted">{e.phone}</span>
                        </div>
                      </div>
                    </Td>
                    <Td className="max-w-64 truncate text-fg-muted">{e.interest ?? e.service?.name ?? '—'}</Td>
                    <Td><Badge>{t(`enquiries.sources.${e.source}`)}</Badge></Td>
                    <Td className="whitespace-nowrap">{e.assignee?.name ?? <span className="text-fg-subtle">{t('enquiries.unassigned')}</span>}</Td>
                    <Td className="whitespace-nowrap">
                      {e.next_follow_up_at ? (
                        <span className={e.is_overdue ? 'font-semibold text-danger' : ''}>
                          {f.instant(e.next_follow_up_at, 'd MMM, h:mm a')}
                          {e.is_overdue && <Badge tone="danger" className="ms-2">{t('enquiries.overdue')}</Badge>}
                        </span>
                      ) : '—'}
                    </Td>
                    <Td className="whitespace-nowrap text-fg-muted">{f.instant(e.created_at, 'd MMM yyyy')}</Td>
                    <Td><StatusBadge status={e.status} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={data.meta.current_page}
              lastPage={data.meta.last_page}
              total={data.meta.total}
              onChange={(p) => setPage(String(p))}
              labels={{ previous: t('common:pagination.previous'), next: t('common:pagination.next'), page: (pg, tot) => t('common:pagination.page', { page: pg, total: tot }) }}
            />
          </>
        )}
      </Card>

      {creating && (
        <EnquiryFormDialog
          onClose={() => {
            setCreating(false);
            setParams((p) => {
              p.delete('new');
              return p;
            });
          }}
          onSaved={(e) => {
            setCreating(false);
            setOpen(e.id);
          }}
        />
      )}
      <EnquiryDrawer enquiryId={openId} onClose={() => setOpen(null)} />
    </div>
  );
}
