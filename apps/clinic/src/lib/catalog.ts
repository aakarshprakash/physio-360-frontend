import { api, unwrap, type InsurancePayer, type PackagePlan, type Room, type Service, type StaffUser } from '@physio/api';
import { useQuery } from '@tanstack/react-query';

const LONG = 5 * 60_000;

export function useServices(includeInactive = false) {
  return useQuery({
    queryKey: ['services', includeInactive],
    queryFn: async () => (await unwrap(api.GET('/settings/services', { params: { query: { include_inactive: includeInactive } as never } }))).data as Service[],
    staleTime: LONG,
  });
}

export function usePackagePlans(includeInactive = false) {
  return useQuery({
    queryKey: ['package-plans', includeInactive],
    queryFn: async () => (await unwrap(api.GET('/settings/package-plans', { params: { query: { include_inactive: includeInactive } as never } }))).data as PackagePlan[],
    staleTime: LONG,
  });
}

export function useStaff(opts: { practitionersOnly?: boolean; includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: ['staff', opts],
    queryFn: async () =>
      (await unwrap(api.GET('/staff', { params: { query: { practitioners_only: opts.practitionersOnly, include_inactive: opts.includeInactive } as never } }))).data as StaffUser[],
    staleTime: LONG,
  });
}

export function usePayers() {
  return useQuery({
    queryKey: ['payers'],
    queryFn: async () => (await unwrap(api.GET('/settings/insurance-payers'))).data as InsurancePayer[],
    staleTime: LONG,
  });
}

export function useRooms(branchId?: number) {
  return useQuery({
    queryKey: ['rooms', branchId],
    queryFn: async () => (await unwrap(api.GET('/settings/rooms', { params: { query: { branch_id: branchId } as never } }))).data as Room[],
    staleTime: LONG,
  });
}
