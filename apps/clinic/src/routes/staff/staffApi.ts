import { api, unwrap, type StaffUser } from '@physio/api';
import { useQuery } from '@tanstack/react-query';

export const ROLES = ['owner', 'admin', 'therapist', 'receptionist', 'accountant'] as const;
export type RoleKey = (typeof ROLES)[number];
export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'visiting', 'intern'] as const;

/** Employee record as returned to team managers (and to the person themselves). */
export interface StaffProfile extends StaffUser {
  role?: RoleKey | null;
  role_label?: string | null;
  employee_code?: string | null;
  employment_type?: (typeof EMPLOYMENT_TYPES)[number] | null;
  joined_on?: string | null;
  qualification?: string | null;
  registration_number?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  geofence_exempt?: boolean;
  online_bookable?: boolean;
  date_of_birth?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  hr_notes?: string | null;
  password_changed_at?: string | null;
  created_at?: string | null;
}

export interface Presence {
  state: 'in' | 'out' | 'leave' | 'absent';
  check_in: string | null;
  check_out: string | null;
  is_late: boolean;
  leave: string | null;
}

export interface TeamSummary {
  total: number;
  practitioners: number;
  clocked_in: number;
  on_leave: number;
  not_in: number;
  late: number;
  pending_leave: number;
}

export interface LeaveBalance {
  leave_type_id: number;
  name: string;
  code: string;
  color: string;
  is_paid: boolean;
  quota: number | string;
  used: number;
  pending: number;
  remaining: number | null;
}

export interface AttendanceDay {
  date: string;
  status: string | null;
  check_in: string | null;
  check_out: string | null;
  minutes: number | null;
  is_late: boolean;
  check_in_distance_m?: number | null;
  device?: string | null;
}

export interface StaffDetail {
  profile: StaffProfile;
  stats: {
    month: string;
    appointments: { total: number; completed: number; cancelled: number; no_show: number; completion_rate: number | null; upcoming_7_days: number };
    patients_seen: number;
    revenue_minor: number;
    rating: { average: number | null; count: number };
    attendance: { present: number; absent: number; leave: number; late: number; minutes: number; unmarked: number } | null;
    attendance_days: AttendanceDay[];
    leave_balances: LeaveBalance[];
    presence_today: Presence;
  };
  permissions: string[];
  devices: { id: number; name: string; last_used_at: string | null; created_at: string | null }[];
  activity: { id: number; event: string; subject: string | null; subject_id: number | null; ip: string | null; at: string | null }[];
}

export interface RoleMatrix {
  permissions: { key: string; label: string }[];
  roles: { key: RoleKey; label: string; description: string; permissions: string[]; members: number }[];
}

export function useTeam() {
  return useQuery({
    queryKey: ['staff', 'directory'],
    queryFn: async () => {
      const r = (await unwrap(api.GET('/staff', { params: { query: { include_inactive: true, with_presence: true } as never } }))) as unknown as {
        data: StaffProfile[];
        meta?: { presence?: Record<string, Presence> };
      };
      return { members: r.data, presence: r.meta?.presence ?? {} };
    },
    refetchInterval: 60_000,
  });
}

export function useTeamSummary() {
  return useQuery({
    queryKey: ['staff', 'summary'],
    queryFn: async () => ((await unwrap(api.GET('/staff/summary'))) as unknown as { data: TeamSummary }).data,
    refetchInterval: 60_000,
  });
}

export function useStaffDetail(userId: number, month: string) {
  return useQuery({
    queryKey: ['staff', 'detail', userId, month],
    queryFn: async () => ((await unwrap(api.GET('/staff/{user}', { params: { path: { user: userId }, query: { month } as never } }))) as unknown as { data: StaffDetail }).data,
  });
}

export function useRoleMatrix() {
  return useQuery({
    queryKey: ['staff', 'roles'],
    queryFn: async () => ((await unwrap(api.GET('/staff/roles'))) as unknown as { data: RoleMatrix }).data,
    staleTime: 5 * 60_000,
  });
}
