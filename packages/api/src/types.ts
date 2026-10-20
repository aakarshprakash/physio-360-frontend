import type { components } from './schema';

/** Friendly aliases for the generated OpenAPI schemas. */
type S = components['schemas'];

export type Appointment = S['AppointmentResource'];
export type Assessment = S['AssessmentResource'];
export type AuditLog = S['AuditLogResource'];
export type Branch = S['BranchResource'];
export type ClinicalNote = S['ClinicalNoteResource'];
export type ConsentSignature = S['ConsentSignatureResource'];
export type ConsentTemplate = S['ConsentTemplateResource'];
export type DocumentFile = S['DocumentResource'];
export type Enquiry = S['EnquiryResource'];
export type Exercise = S['ExerciseResource'];
export type Feedback = S['FeedbackResource'];
export type InsurancePayer = S['InsurancePayerResource'];
export type Invoice = S['InvoiceResource'];
export type PackagePlan = S['PackagePlanResource'];
export type PatientSummary = S['PatientListResource'];
export type Patient = S['PatientResource'];
export type PatientPackage = S['PatientPackageResource'];
export type Payment = S['PaymentResource'];
export type PlanExercise = S['PlanExerciseResource'];
export type ProgressEntry = S['ProgressEntryResource'];
export type Room = S['RoomResource'];
export type Service = S['ServiceResource'];
export type Tenant = S['TenantResource'];
export type TreatmentPlan = S['TreatmentPlanResource'];
export type Prescription = S['PrescriptionResource'];
export type Message = S['MessageResource'];
export type MessageTemplate = S['MessageTemplateResource'];
export type LeaveRequest = S['LeaveRequestResource'];
export type PayrollRun = S['PayrollRunResource'];
export type Payslip = S['PayslipResource'];
export type SupportTicket = S['SupportTicketResource'];
/** roles/branch_ids are built from relation plucks, which the generator types loosely. */
export type StaffUser = Omit<S['UserResource'], 'roles' | 'branch_ids'> & { roles?: string[]; branch_ids?: number[] };

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type InvoiceStatus = 'draft' | 'posted' | 'void' | 'credited';
export type PaymentStatus = 'paid' | 'partially_paid' | 'unpaid';
export type EnquiryStatus = 'new' | 'contacted' | 'follow_up' | 'converted' | 'lost';
export type PaymentMethodCode = 'cash' | 'card' | 'upi' | 'bank_transfer' | 'insurance' | 'online';

export const ENQUIRY_SOURCES = ['walk_in', 'phone', 'website', 'whatsapp', 'referral', 'social', 'other'] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

export const PERMISSIONS = [
  'patients.view', 'patients.manage', 'patients.delete',
  'appointments.view', 'appointments.manage',
  'clinical.view', 'clinical.write', 'exercises.manage',
  'enquiries.manage',
  'billing.view', 'billing.manage', 'billing.void',
  'reports.view', 'staff.manage', 'settings.manage', 'audit.view',
  'messages.send', 'attendance.manage', 'leave.approve', 'payroll.manage',
  'branches.all',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const MESSAGE_CHANNELS = ['whatsapp', 'sms', 'email'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
export const MESSAGE_PURPOSES = ['appointment_reminder', 'payment_reminder', 'follow_up', 'birthday', 'general'] as const;
export type MessagePurpose = (typeof MESSAGE_PURPOSES)[number];
export const SUPPORT_CATEGORIES = ['question', 'bug', 'billing', 'feature', 'training', 'data'] as const;
export const SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const ATTENDANCE_STATUSES = ['present', 'half_day', 'absent', 'leave', 'holiday'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/*
 * Endpoints that answer with shaped JSON (not an API Resource) are typed by
 * hand here; the generator only sees them as loose objects.
 */
export interface PageMeta {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export interface ConsultationRow {
  id: number;
  patient: { id: number; full_name: string; mrn: string; age: number | null; gender: string | null };
  practitioner: { id: number; name: string; color: string };
  assessed_at: string;
  chief_complaint: string;
  pain_score: number | null;
  diagnosis: string | null;
  status: 'draft' | 'signed';
  prescription_id: number | null;
}

export type TimelineType = 'registered' | 'appointment' | 'assessment' | 'note' | 'plan' | 'prescription' | 'progress' | 'document' | 'consent' | 'invoice' | 'payment' | 'message';
export interface TimelineEvent {
  key: string;
  type: TimelineType;
  at: string;
  status: string | null;
  data: Record<string, string | number | null>;
}

export interface PackageRow {
  id: number;
  name: string;
  patient: { id: number; full_name: string; mrn: string; phone: string | null };
  invoice_id: number | null;
  sessions_total: number;
  sessions_remaining: number;
  purchased_on: string | null;
  expires_on: string | null;
  expiring_soon: boolean;
  status: string;
}

export interface ReminderRow {
  id: number;
  number: string;
  patient: { id: number; full_name: string; mrn: string; has_phone: boolean; has_email: boolean };
  issue_date: string | null;
  due_date: string | null;
  days_overdue: number;
  total_minor: number;
  balance_minor: number;
  reminder_count: number;
  last_reminded_at: string | null;
}

export interface ReminderAutomation {
  enabled: boolean;
  channel: MessageChannel;
  days_after_due: number[];
  include_payment_link: boolean;
}

export type ChannelReadiness = Record<MessageChannel, boolean>;

export interface AttendanceToday {
  date: string;
  status: AttendanceStatus | null;
  check_in: string | null;
  check_out: string | null;
  check_in_at: string | null;
  minutes_worked: number | null;
  is_late: boolean;
  on_leave: 'full' | 'am' | 'pm' | null;
  can_check_in: boolean;
  can_check_out: boolean;
}

export type RegisterStatus = AttendanceStatus | 'unmarked' | 'off' | null;
export interface RegisterCell {
  status: RegisterStatus;
  check_in: string | null;
  check_out: string | null;
  minutes: number | null;
  is_late: boolean;
  notes: string | null;
  leave: { type: string; half_day: 'am' | 'pm' | null; color: string; paid: boolean } | null;
}
export interface AttendanceRegister {
  month: string;
  days: { date: string; weekday: number; weekly_off: boolean; holiday: string | null }[];
  rows: {
    user: { id: number; name: string; title: string | null; color: string };
    cells: Record<string, RegisterCell>;
    summary: { present: number; absent: number; leave: number; late: number; minutes: number; unmarked: number };
  }[];
}

export interface LeaveBalance {
  leave_type_id: number;
  name: string;
  code: string;
  color: string;
  is_paid: boolean;
  quota: number;
  used: number;
  pending: number;
  remaining: number | null;
}

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  annual_quota: number;
  is_paid: boolean;
  color: string;
  is_active: boolean;
}

export interface PayLine {
  name: string;
  amount_minor: number;
}

export interface SalaryRow {
  user: { id: number; name: string; title: string | null; color: string };
  salary: {
    basic_minor: number;
    allowances: PayLine[];
    deductions: PayLine[];
    effective_from: string;
    bank_account: string | null;
    tax_id: string | null;
    monthly_gross_minor: number;
    monthly_net_minor: number;
  } | null;
}

export interface SupportContact {
  email: string;
  phone: string | null;
  whatsapp: string | null;
  hours: string | null;
  docs_url: string | null;
}

/** Laravel paginator envelope. */
export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null };
  links?: unknown;
}
