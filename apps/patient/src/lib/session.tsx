import { api, onUnauthorized, type Tenant } from '@physio/api';
import { formatInZone, formatLocal, formatMoney, numberLocale } from '@physio/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface PatientSession {
  patient: { id: number; mrn: string; first_name: string; full_name: string; email: string | null; phone: string | null; preferred_language: string };
  clinic: Tenant;
}

export const sessionKey = ['patient-session'] as const;
const CLINIC_KEY = 'physio360.clinic';

export function rememberedClinic(): string {
  try {
    return new URLSearchParams(window.location.search).get('clinic') ?? localStorage.getItem(CLINIC_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberClinic(slug: string): void {
  try {
    localStorage.setItem(CLINIC_KEY, slug);
  } catch {
    /* ignore */
  }
}

export function useSessionQuery() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      const { data, response } = await api.GET('/patient/me');
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new Error('session');
      return (data as unknown as { data: PatientSession }).data;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
}

const Ctx = createContext<PatientSession | null>(null);

export function SessionProvider({ session, children }: { session: PatientSession; children: ReactNode }) {
  const client = useQueryClient();
  useEffect(() => onUnauthorized(() => client.setQueryData(sessionKey, null)), [client]);
  return <Ctx.Provider value={session}>{children}</Ctx.Provider>;
}

export function useSession(): PatientSession {
  const s = useContext(Ctx);
  if (!s) throw new Error('No patient session');
  return s;
}

/** Money and dates always in the clinic's currency and timezone. */
export function useFormat() {
  const { clinic } = useSession();
  const { i18n } = useTranslation();
  return useMemo(() => {
    const locale = numberLocale(i18n.language, clinic.country_code);
    return {
      tz: clinic.timezone,
      money: (minor: number) => formatMoney(minor, clinic.currency, locale),
      local: (v: string, p = 'EEE d MMM, h:mm a') => formatLocal(v, p, i18n.language),
      instant: (v: string, p = 'd MMM yyyy') => formatInZone(v, clinic.timezone, p, i18n.language),
    };
  }, [clinic, i18n.language]);
}
