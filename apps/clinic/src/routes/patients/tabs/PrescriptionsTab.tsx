import { api, unwrap, type Patient, type Prescription } from '@physio/api';
import { Button, Card, EmptyState, Skeleton } from '@physio/ui';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { openPdf } from '../../../lib/pdf';
import { useSession } from '../../../lib/session';
import { PrescriptionCard } from '../../prescriptions/PrescriptionCard';
import { PrescriptionDialog } from '../../prescriptions/PrescriptionDialog';

export function PrescriptionsTab({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const [editing, setEditing] = useState<Prescription | 'new' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['patient', patient.id, 'prescriptions'],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}/prescriptions', { params: { path: { patient: patient.id } } }))).data as Prescription[],
  });

  return (
    <div className="space-y-5">
      {can('clinical.write') && (
        <Button onClick={() => setEditing('new')}>
          <Plus />
          {t('prescriptions.new')}
        </Button>
      )}
      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={<FileText />} title={t('prescriptions.empty')} description={t('prescriptions.emptyHint')} />
        </Card>
      ) : (
        data.map((rx) => <PrescriptionCard key={rx.id} rx={rx} onEdit={() => setEditing(rx)} />)
      )}

      {editing && (
        <PrescriptionDialog
          patient={{ id: patient.id, full_name: patient.full_name, mrn: patient.mrn }}
          prescription={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(rx) => {
            const isNew = editing === 'new';
            setEditing(null);
            if (isNew) openPdf(`/prescriptions/${rx.id}/pdf`);
          }}
        />
      )}
    </div>
  );
}
