import type { Patient } from '@physio/api';
import { addDays, todayInZone } from '@physio/core';
import { Card, EmptyState, Skeleton, Table, Td, Th, Tr } from '@physio/ui';
import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { StatusBadge } from '../../../components/common';
import { useAppointments } from '../../../lib/appointments';
import { useFormat } from '../../../lib/format';

export function AppointmentsTab({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const today = todayInZone(f.tz);
  const { data, isLoading } = useAppointments({ from: addDays(today, -365), to: addDays(today, 180), patientId: patient.id });
  const rows = [...(data ?? [])].sort((a, b) => b.local_start.localeCompare(a.local_start));

  return (
    <Card>
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-11" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title={t('appointments.empty')} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('appointments.date')}</Th>
              <Th>{t('appointments.practitioner')}</Th>
              <Th>{t('appointments.service')}</Th>
              <Th>{t('appointments.type')}</Th>
              <Th>{t('patients.status')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <Tr key={a.id} interactive onClick={() => navigate(`/appointments?date=${a.local_start.slice(0, 10)}&open=${a.id}`)}>
                <Td className="tabular whitespace-nowrap font-medium">{f.local(a.local_start, 'EEE d MMM yyyy, h:mm a')}</Td>
                <Td>{a.practitioner?.name}</Td>
                <Td>{a.service?.name ?? '—'}</Td>
                <Td>{t(`common:appointmentType.${a.type}`)}</Td>
                <Td>
                  <StatusBadge status={a.status} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
