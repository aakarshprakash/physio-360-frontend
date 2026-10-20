import { api, unwrap, type ConsultationRow, type PageMeta } from '@physio/api';
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Pagination, SearchInput, Segmented, Select, Skeleton, StatCard, Table, Td, Th, Tr } from '@physio/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ClipboardPen, FilePlus2, FileText, Lock, PenLine, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useStaff } from '../../lib/catalog';
import { useFormat } from '../../lib/format';
import { useDebounced, useUrlState } from '../../lib/hooks';
import { openPdf } from '../../lib/pdf';
import { useSession } from '../../lib/session';
import { PrescriptionDialog } from '../prescriptions/PrescriptionDialog';

interface Response {
  data: ConsultationRow[];
  meta: PageMeta;
  summary: { this_month: number; unsigned: number; without_prescription: number };
}

export function ConsultationsPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const { can } = useSession();
  const [status, setStatus] = useUrlState('status', 'all');
  const [practitioner, setPractitioner] = useUrlState('practitioner');
  const [page, setPage] = useUrlState('page', '1');
  const [text, setText] = useState('');
  const search = useDebounced(text, 300);
  const [writing, setWriting] = useState<ConsultationRow | null>(null);
  const { data: staff } = useStaff({ practitionersOnly: true });

  const { data, isLoading } = useQuery({
    queryKey: ['consultations', { status, practitioner, page, search }],
    queryFn: () =>
      unwrap(api.GET('/consultations', {
        params: {
          query: {
            status: status === 'all' ? undefined : status,
            practitioner_id: practitioner ? Number(practitioner) : undefined,
            search: search || undefined,
            page: Number(page),
          } as never,
        },
      })) as unknown as Promise<Response>,
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title={t('consultations.title')}
        description={t('consultations.subtitle')}
        actions={can('clinical.write') && (
          <Button variant="outline" onClick={() => navigate('/patients')} title={t('consultations.newConsultationHint')}>
            <ClipboardPen />
            {t('consultations.newConsultation')}
          </Button>
        )}
      />

      <section className="mb-5 grid gap-4 sm:grid-cols-3" aria-label={t('consultations.title')}>
        {data ? (
          <>
            <StatCard label={t('consultations.summary.thisMonth')} value={data.summary.this_month} icon={<Stethoscope />} tone="primary" />
            <StatCard label={t('consultations.summary.unsigned')} value={data.summary.unsigned} icon={<PenLine />} tone="warning" />
            <StatCard label={t('consultations.summary.withoutRx')} value={data.summary.without_prescription} icon={<FileText />} tone="violet" />
          </>
        ) : (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        )}
      </section>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Segmented
            label={t('consultations.status')}
            value={status as 'all' | 'draft' | 'signed'}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('consultations.filters.all') },
              { value: 'draft', label: t('consultations.filters.draft') },
              { value: 'signed', label: t('consultations.filters.signed') },
            ]}
          />
          <SearchInput className="min-w-52 flex-1" placeholder={`${t('consultations.patient')} / ${t('consultations.complaint')}`} aria-label={t('common:actions.search')} value={text} onChange={(e) => setText(e.target.value)} />
          <Select aria-label={t('consultations.practitioner')} className="w-56" value={practitioner} onChange={(e) => setPractitioner(e.target.value)}>
            <option value="">{t('appointments.allPractitioners')}</option>
            {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.data.length ? (
          <EmptyState icon={<Stethoscope />} title={t('consultations.empty')} description={t('consultations.emptyHint')} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>{t('consultations.date')}</Th>
                  <Th>{t('consultations.patient')}</Th>
                  <Th>{t('consultations.complaint')}</Th>
                  <Th>{t('consultations.practitioner')}</Th>
                  <Th>{t('consultations.status')}</Th>
                  <Th>{t('consultations.prescription')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((c) => (
                  <Tr key={c.id}>
                    <Td className="whitespace-nowrap text-fg-muted">{f.instant(c.assessed_at, 'd MMM yyyy')}</Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={c.patient.full_name} size={32} />
                        <div className="min-w-0">
                          <Link to={`/patients/${c.patient.id}?tab=assessments`} className="block max-w-48 truncate font-semibold hover:underline">{c.patient.full_name}</Link>
                          <span className="text-xs text-fg-muted">
                            {c.patient.mrn}
                            {c.patient.age != null && <> · {t('patients.years', { count: c.patient.age })}</>}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td className="max-w-72">
                      <p className="truncate">{c.chief_complaint}</p>
                      {c.diagnosis && <p className="truncate text-xs text-fg-muted">{c.diagnosis}</p>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: c.practitioner.color }} />
                        {c.practitioner.name}
                      </span>
                    </Td>
                    <Td>
                      {c.status === 'signed' ? (
                        <Badge tone="success"><Lock className="size-3" />{t('common:status.signed')}</Badge>
                      ) : (
                        <Badge>{t('common:status.draft')}</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {c.prescription_id ? (
                        <Button variant="ghost" size="sm" onClick={() => openPdf(`/prescriptions/${c.prescription_id}/pdf`)}>
                          <FileText />
                          {t('consultations.printPrescription')}
                        </Button>
                      ) : can('clinical.write') ? (
                        <Button variant="secondary" size="sm" onClick={() => setWriting(c)}>
                          <FilePlus2 />
                          {t('consultations.writePrescription')}
                        </Button>
                      ) : (
                        <span className="text-fg-subtle">{t('consultations.notIssued')}</span>
                      )}
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
          </>
        )}
      </Card>

      {writing && (
        <PrescriptionDialog
          patient={{ id: writing.patient.id, full_name: writing.patient.full_name, mrn: writing.patient.mrn }}
          assessmentId={writing.id}
          onClose={() => setWriting(null)}
          onSaved={(rx) => {
            setWriting(null);
            openPdf(`/prescriptions/${rx.id}/pdf`);
          }}
        />
      )}
    </div>
  );
}
