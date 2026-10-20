import { api, unwrap, type AuditLog } from '@physio/api';
import { Badge, Card, EmptyState, PageHeader, Skeleton, Table, Td, Th } from '@physio/ui';
import { useQuery } from '@tanstack/react-query';

export function AuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-audit'],
    queryFn: async () => (await unwrap(api.GET('/platform/audit-logs'))).data as AuditLog[],
  });

  return (
    <div>
      <PageHeader title="Platform audit" description="Operator sign-ins and tenant lifecycle events (append-only)." />
      <Card>
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-60" /></div>
        ) : !data?.length ? (
          <EmptyState title="No events yet" />
        ) : (
          <Table>
            <thead><tr><Th>When</Th><Th>Who</Th><Th>Event</Th><Th>Record</Th><Th>IP</Th></tr></thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.id}>
                  <Td className="tabular whitespace-nowrap text-fg-muted">{new Date(l.created_at).toLocaleString()}</Td>
                  <Td>{l.actor_name ?? 'System'}</Td>
                  <Td><Badge>{l.event}</Badge></Td>
                  <Td>{l.auditable_type ? `${l.auditable_type} #${l.auditable_id}` : '—'}</Td>
                  <Td className="text-fg-muted">{l.ip_address ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
