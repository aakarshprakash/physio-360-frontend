import { api, unwrap, type AuditLog } from '@physio/api';
import { Badge, Card, EmptyState, PageHeader, Pagination, Select, Skeleton, Table, Td, Th } from '@physio/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormat } from '../../lib/format';
import { useUrlState } from '../../lib/hooks';

const EVENTS = ['created', 'updated', 'deleted', 'login', 'portal_login', 'exported', 'downloaded'];
const TYPES = ['Patient', 'Appointment', 'ClinicalNote', 'Assessment', 'Invoice', 'Payment', 'CreditNote', 'TreatmentPlan', 'Enquiry', 'User', 'Service', 'ConsentSignature', 'Document'];

function summarize(values: Record<string, unknown> | null | undefined): string {
  if (!values) return '';
  return Object.entries(values)
    .filter(([k]) => !['id', 'tenant_id'].includes(k))
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

export function AuditPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const [event, setEvent] = useUrlState('event');
  const [type, setType] = useUrlState('type');
  const [page, setPage] = useUrlState('page', '1');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', { event, type, page }],
    queryFn: () => unwrap(api.GET('/audit-logs', { params: { query: { event: event || undefined, auditable_type: type || undefined, page: Number(page) } as never } })) as unknown as Promise<{ data: AuditLog[]; meta: { current_page: number; last_page: number; total: number } }>,
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader title={t('audit.title')} description={t('audit.subtitle')} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <Select aria-label={t('audit.event')} className="w-48" value={event} onChange={(e) => setEvent(e.target.value)}>
            <option value="">{t('audit.event')}: {t('billing.all')}</option>
            {EVENTS.map((e) => <option key={e} value={e}>{e}</option>)}
          </Select>
          <Select aria-label={t('audit.record')} className="w-52" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t('audit.record')}: {t('billing.all')}</option>
            {TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
          </Select>
        </div>
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-60" /></div>
        ) : !data?.data.length ? (
          <EmptyState icon={<ScrollText />} title={t('audit.empty')} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>{t('audit.when')}</Th>
                  <Th>{t('audit.who')}</Th>
                  <Th>{t('audit.event')}</Th>
                  <Th>{t('audit.record')}</Th>
                  <Th>{t('audit.changes')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((log) => (
                  <tr key={log.id}>
                    <Td className="tabular whitespace-nowrap text-fg-muted">{f.instant(log.created_at, 'd MMM yyyy, HH:mm:ss')}</Td>
                    <Td className="whitespace-nowrap">{log.actor_name ?? t('audit.system')}<div className="text-xs text-fg-subtle">{log.actor_type} {log.ip_address && `· ${log.ip_address}`}</div></Td>
                    <Td><Badge tone={log.event === 'deleted' ? 'danger' : log.event === 'created' ? 'success' : 'neutral'}>{log.event}</Badge></Td>
                    <Td className="whitespace-nowrap">{log.auditable_type ? `${log.auditable_type} #${log.auditable_id}` : '—'}</Td>
                    <Td className="max-w-md text-xs text-fg-muted"><span className="line-clamp-2 break-all">{summarize((log.new_values ?? log.old_values) as unknown as Record<string, unknown> | null)}</span></Td>
                  </tr>
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
