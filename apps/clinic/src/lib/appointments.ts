import { api, unwrap, type Appointment, type AppointmentStatus } from '@physio/api';
import { useQuery } from '@tanstack/react-query';

export interface CalendarResources {
  practitioners: {
    id: number;
    name: string;
    title: string | null;
    color: string;
    working_hours: { weekday: number; start_time: string; end_time: string }[];
  }[];
  rooms: { id: number; name: string; branch_id: number }[];
}

export function useCalendarResources(branchId: number) {
  return useQuery({
    queryKey: ['calendar-resources', branchId],
    queryFn: async () => (await unwrap(api.GET('/calendar/resources', { params: { query: { branch_id: branchId } } })) as unknown as { data: CalendarResources }).data,
    enabled: branchId > 0,
    staleTime: 5 * 60_000,
  });
}

export function useAppointments(params: { from: string; to: string; branchId?: number | null; practitionerIds?: number[]; patientId?: number }) {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: async () =>
      (
        await unwrap(
          api.GET('/appointments', {
            params: {
              query: {
                from: params.from,
                to: params.to,
                branch_id: params.branchId ?? undefined,
                practitioner_ids: params.practitionerIds?.length ? params.practitionerIds : undefined,
                patient_id: params.patientId,
              },
            },
          }),
        )
      ).data as Appointment[],
    refetchInterval: 60_000,
  });
}

/** Visit workflow actions in display order. */
export const STATUS_ACTIONS: { to: AppointmentStatus; key: string; variant: 'primary' | 'outline' | 'danger-ghost' }[] = [
  { to: 'confirmed', key: 'confirm', variant: 'outline' },
  { to: 'checked_in', key: 'checkIn', variant: 'primary' },
  { to: 'in_progress', key: 'start', variant: 'primary' },
  { to: 'completed', key: 'complete', variant: 'primary' },
  { to: 'no_show', key: 'noShow', variant: 'danger-ghost' },
  { to: 'cancelled', key: 'cancel', variant: 'danger-ghost' },
];
