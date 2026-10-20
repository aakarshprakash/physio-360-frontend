import { api, unwrap, type Appointment, type ConsentSignature, type ConsentTemplate, type Invoice, type TreatmentPlan } from '@physio/api';
import { useQuery } from '@tanstack/react-query';

export type PortalAppointment = Appointment & { can_cancel: boolean; feedback_given: boolean };

export function useMyAppointments() {
  return useQuery({
    queryKey: ['my', 'appointments'],
    queryFn: async () => (await unwrap(api.GET('/patient/appointments')) as unknown as { data: { upcoming: PortalAppointment[]; past: PortalAppointment[] } }).data,
  });
}

export function useMyPlans() {
  return useQuery({
    queryKey: ['my', 'plans'],
    queryFn: async () => (await unwrap(api.GET('/patient/treatment-plans')) as unknown as { data: TreatmentPlan[] }).data,
  });
}

export function useMyConsents() {
  return useQuery({
    queryKey: ['my', 'consents'],
    queryFn: async () => (await unwrap(api.GET('/patient/consents')) as unknown as { data: { pending: ConsentTemplate[]; signed: ConsentSignature[] } }).data,
  });
}

export function useMyInvoices() {
  return useQuery({
    queryKey: ['my', 'invoices'],
    queryFn: async () => (await unwrap(api.GET('/patient/invoices')) as unknown as { data: Invoice[] }).data,
  });
}
