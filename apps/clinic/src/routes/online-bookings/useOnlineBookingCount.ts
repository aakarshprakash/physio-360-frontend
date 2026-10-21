import { api, unwrap } from '@physio/api';
import { useQuery } from '@tanstack/react-query';

/** Requests waiting for the front desk (nav badge). */
export function useOnlineBookingCount(enabled: boolean) {
  return useQuery({
    queryKey: ['online-bookings', 'pending-count'],
    queryFn: async () =>
      ((await unwrap(api.GET('/online-bookings', { params: { query: { status: 'pending' } as never } }))) as unknown as { meta: { counts: { pending: number } } }).meta.counts.pending,
    enabled,
    refetchInterval: 60_000,
  });
}
