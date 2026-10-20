import { api, unwrap, type Paginated, type Prescription } from '@physio/api';
import { Button, Card, EmptyState, PageHeader, Pagination, SearchInput, Select, Skeleton } from '@physio/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStaff } from '../../lib/catalog';
import { useDebounced, useUrlState } from '../../lib/hooks';
import { openPdf } from '../../lib/pdf';
import { useSession } from '../../lib/session';
import { PrescriptionCard } from './PrescriptionCard';
import { PrescriptionDialog } from './PrescriptionDialog';

export function PrescriptionsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [practitioner, setPractitioner] = useUrlState('practitioner');
  const [page, setPage] = useUrlState('page', '1');
  const [text, setText] = useState('');
  const search = useDebounced(text, 300);
  const [editing, setEditing] = useState<Prescription | 'new' | null>(null);
  const { data: staff } = useStaff({ practitionersOnly: true });

  const { data, isLoading } = useQuery({
    queryKey: ['prescriptions', { practitioner, page, search }],
    queryFn: () =>
      unwrap(api.GET('/prescriptions', {
        params: { query: { practitioner_id: practitioner ? Number(practitioner) : undefined, search: search || undefined, page: Number(page) } as never },
      })) as unknown as Promise<Paginated<Prescription>>,
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title={t('prescriptions.title')}
        description={t('prescriptions.subtitle')}
        actions={can('clinical.write') && (
          <Button onClick={() => setEditing('new')}>
            <Plus />
            {t('prescriptions.new')}
          </Button>
        )}
      />

      <Card className="mb-5 flex flex-wrap items-center gap-3 p-4">
        <SearchInput className="min-w-52 flex-1" placeholder={`${t('consultations.patient')} / ${t('prescriptions.number')}`} aria-label={t('common:actions.search')} value={text} onChange={(e) => setText(e.target.value)} />
        <Select aria-label={t('consultations.practitioner')} className="w-56" value={practitioner} onChange={(e) => setPractitioner(e.target.value)}>
          <option value="">{t('appointments.allPractitioners')}</option>
          {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Card>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
      ) : !data?.data.length ? (
        <Card>
          <EmptyState icon={<FileText />} title={t('prescriptions.empty')} description={t('prescriptions.emptyHint')} />
        </Card>
      ) : (
        <div className="space-y-4">
          {data.data.map((rx) => <PrescriptionCard key={rx.id} rx={rx} showPatient onEdit={() => setEditing(rx)} />)}
          <Card>
            <Pagination
              page={data.meta.current_page}
              lastPage={data.meta.last_page}
              total={data.meta.total}
              onChange={(p) => setPage(String(p))}
              labels={{ previous: t('common:pagination.previous'), next: t('common:pagination.next'), page: (pg, tot) => t('common:pagination.page', { page: pg, total: tot }) }}
            />
          </Card>
        </div>
      )}

      {editing && (
        <PrescriptionDialog
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
