import { api, unwrap } from '@physio/api';
import { Avatar, Button, Card, EmptyState, PageHeader, Pagination, SearchInput, Select, Skeleton, Table, Td, Th, Tr } from '@physio/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { openFile } from '@physio/api';
import { StatusBadge } from '../../components/common';
import { useStaff } from '../../lib/catalog';
import { toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useDebounced, useUrlState } from '../../lib/hooks';
import { useSession } from '../../lib/session';
import { PatientFormDialog } from './PatientFormDialog';

export function PatientsPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const { can, branchId } = useSession();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useUrlState('q');
  const [status, setStatus] = useUrlState('status');
  const [practitioner, setPractitioner] = useUrlState('practitioner');
  const [pageParam, setPage] = useUrlState('page', '1');
  const [searchText, setSearchText] = useState(search);
  const debounced = useDebounced(searchText, 300);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const { data: practitioners } = useStaff({ practitionersOnly: true });

  useEffect(() => {
    if (debounced !== search) setSearch(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  const page = Number(pageParam) || 1;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['patients', 'list', { search, status, practitioner, page, branchId }],
    queryFn: () =>
      unwrap(
        api.GET('/patients', {
          params: {
            query: {
              search: search || undefined,
              status: (status || undefined) as never,
              practitioner_id: practitioner ? Number(practitioner) : undefined,
              branch_id: branchId ?? undefined,
              page,
              per_page: 20,
            } as never,
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title={t('patients.title')}
        description={t('patients.subtitle')}
        actions={
          <>
            {can('reports.view') && (
              <Button variant="outline" onClick={() => openFile('/exports/patients', 'patients.csv').catch(toastError)}>
                <Download />
                {t('reports.exportPatients')}
              </Button>
            )}
            {can('patients.manage') && (
              <Button onClick={() => setCreating(true)}>
                <UserPlus />
                {t('patients.new')}
              </Button>
            )}
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <SearchInput className="min-w-60 flex-1" placeholder={t('patients.search')} aria-label={t('patients.search')} value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          <Select aria-label={t('patients.status')} className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('billing.all')}</option>
            {['active', 'inactive', 'discharged'].map((s) => (
              <option key={s} value={s}>
                {t(`common:status.${s}`)}
              </option>
            ))}
          </Select>
          <Select aria-label={t('patients.primaryPractitioner')} className="w-52" value={practitioner} onChange={(e) => setPractitioner(e.target.value)}>
            <option value="">{t('appointments.allPractitioners')}</option>
            {practitioners?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !data?.data.length ? (
          <EmptyState
            icon={<Users />}
            title={t('patients.empty')}
            description={search ? undefined : t('patients.emptyHint')}
            action={can('patients.manage') && !search && <Button onClick={() => setCreating(true)}>{t('patients.new')}</Button>}
          />
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
            <Table>
              <thead>
                <tr>
                  <Th>{t('patients.name')}</Th>
                  <Th>{t('patients.mrn')}</Th>
                  <Th>{t('patients.phone')}</Th>
                  <Th>{t('patients.age')}</Th>
                  <Th>{t('patients.primaryPractitioner')}</Th>
                  <Th>{t('patients.lastVisit')}</Th>
                  <Th>{t('patients.nextVisit')}</Th>
                  <Th>{t('patients.status')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => (
                  <Tr key={p.id} interactive onClick={() => navigate(`/patients/${p.id}`)}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={p.full_name} size={34} />
                        <div className="min-w-0">
                          <a href={`/patients/${p.id}`} onClick={(e) => e.preventDefault()} className="block truncate font-semibold hover:underline">
                            {p.full_name}
                          </a>
                          <span className="text-xs text-fg-muted">
                            {p.gender ? t(`common:gender.${p.gender}`) : ''}
                            {p.city ? ` · ${p.city}` : ''}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td className="tabular text-fg-muted">{p.mrn}</Td>
                    <Td className="tabular whitespace-nowrap">{p.phone}</Td>
                    <Td className="tabular">{p.age ?? '—'}</Td>
                    <Td className="whitespace-nowrap">{p.primary_practitioner?.name ?? '—'}</Td>
                    <Td className="whitespace-nowrap text-fg-muted">{f.instant(p.last_visit_at, 'd MMM yyyy')}</Td>
                    <Td className="whitespace-nowrap">{f.instant(p.next_visit_at, 'd MMM, h:mm a')}</Td>
                    <Td>
                      <StatusBadge status={p.status} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={data.meta.current_page}
              lastPage={data.meta.last_page}
              total={data.meta.total}
              onChange={(p) => setPage(String(p))}
              labels={{ previous: t('common:pagination.previous'), next: t('common:pagination.next'), page: (pg, tot) => t('common:pagination.page', { page: pg, total: tot }) }}
            />
          </div>
        )}
      </Card>

      {creating && (
        <PatientFormDialog
          onClose={() => {
            setCreating(false);
            setParams((p) => {
              p.delete('new');
              return p;
            });
          }}
          onSaved={(p) => navigate(`/patients/${p.id}`)}
        />
      )}
    </div>
  );
}
