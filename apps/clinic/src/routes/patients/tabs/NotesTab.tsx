import { api, unwrap, type ClinicalNote, type Patient } from '@physio/api';
import { Alert, Avatar, Badge, Button, Card, CardContent, CardHeader, ConfirmDialog, EmptyState, Field, Input, Skeleton, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, NotebookPen, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { handleFormError, toastError } from '../../../lib/errors';
import { useFormat } from '../../../lib/format';
import { useSession } from '../../../lib/session';

const SOAP = ['subjective', 'objective', 'assessment', 'plan'] as const;
type Soap = Record<(typeof SOAP)[number], string> & { pain_score: string };
const empty: Soap = { subjective: '', objective: '', assessment: '', plan: '', pain_score: '' };

export function NotesTab({ patient, appointmentId }: { patient: Patient; appointmentId: string | null }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const [composing, setComposing] = useState(!!appointmentId && can('clinical.write'));

  const { data, isLoading } = useQuery({
    queryKey: ['patient', patient.id, 'notes'],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}/notes', { params: { path: { patient: patient.id } } }))).data as ClinicalNote[],
  });

  return (
    <div className="space-y-5">
      {can('clinical.write') &&
        (composing ? (
          <NoteEditor patientId={patient.id} appointmentId={appointmentId ? Number(appointmentId) : null} onDone={() => setComposing(false)} />
        ) : (
          <Button onClick={() => setComposing(true)}>
            <NotebookPen />
            {t('clinical.newNote')}
          </Button>
        ))}

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={<NotebookPen />} title={t('clinical.noNotes')} />
        </Card>
      ) : (
        data.map((note) => <NoteCard key={note.id} note={note} patientId={patient.id} />)
      )}
    </div>
  );
}

function NoteEditor({ patientId, appointmentId, note, onDone }: { patientId: number; appointmentId?: number | null; note?: ClinicalNote; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Soap>(
    note ? { subjective: note.subjective ?? '', objective: note.objective ?? '', assessment: note.assessment ?? '', plan: note.plan ?? '', pain_score: note.pain_score?.toString() ?? '' } : empty,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (sign: boolean) => {
      const body = { ...values, pain_score: values.pain_score === '' ? null : Number(values.pain_score), appointment_id: appointmentId ?? undefined, sign };
      return note
        ? unwrap(api.PUT('/notes/{note}', { params: { path: { note: note.id } }, body: body as never })).then(async (r) => (sign ? unwrap(api.POST('/notes/{note}/sign', { params: { path: { note: note.id } } })) : r))
        : unwrap(api.POST('/patients/{patient}/notes', { params: { path: { patient: patientId } }, body: body as never }));
    },
    onSuccess: (_r, sign) => {
      toast.success(sign ? t('clinical.noteSigned') : t('clinical.noteSaved'));
      void queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      onDone();
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  return (
    <Card>
      <CardHeader title={note ? t('common:actions.edit') : t('clinical.newNote')} />
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {SOAP.map((k) => (
            <Field key={k} label={t(`clinical.soap.${k}`)} hint={t(`clinical.soapHints.${k}`)} error={errors[k]}>
              <Textarea rows={4} value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
        <Field label={t('clinical.painScore')} className="max-w-36" error={errors.pain_score}>
          <Input type="number" min={0} max={10} value={values.pain_score} onChange={(e) => setValues({ ...values, pain_score: e.target.value })} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onDone}>{t('common:actions.cancel')}</Button>
          <Button variant="outline" loading={save.isPending && save.variables === false} onClick={() => save.mutate(false)}>
            {t('clinical.saveDraft')}
          </Button>
          <ConfirmDialog
            title={t('clinical.sign')}
            description={t('clinical.signConfirm')}
            confirmLabel={t('clinical.saveAndSign')}
            cancelLabel={t('common:actions.cancel')}
            onConfirm={() => save.mutateAsync(true)}
            trigger={
              <Button>
                <Lock />
                {t('clinical.saveAndSign')}
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function NoteCard({ note, patientId }: { note: ClinicalNote; patientId: number }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { session, can } = useSession();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [addendum, setAddendum] = useState('');
  const signed = note.status === 'signed';
  const mine = note.author?.id === session.user.id;

  const addAddendum = useMutation({
    mutationFn: () => unwrap(api.POST('/notes/{note}/addenda', { params: { path: { note: note.id } }, body: { body: addendum } })),
    onSuccess: () => {
      setAddendum('');
      void queryClient.invalidateQueries({ queryKey: ['patient', patientId, 'notes'] });
    },
    onError: toastError,
  });

  if (editing) return <NoteEditor patientId={patientId} note={note} onDone={() => setEditing(false)} />;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <Avatar name={note.author?.name ?? '?'} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{note.author?.name}</p>
          <p className="text-xs text-fg-muted">{f.instant(note.created_at)}</p>
        </div>
        {note.pain_score != null && <Badge tone="warning">{t('clinical.painScore')}: {note.pain_score}</Badge>}
        {signed ? (
          <Badge tone="success">
            <Lock className="size-3" />
            {t('common:status.signed')}
          </Badge>
        ) : (
          <Badge>{t('clinical.draft')}</Badge>
        )}
        {!signed && mine && can('clinical.write') && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil />
            {t('common:actions.edit')}
          </Button>
        )}
      </div>
      <CardContent className="grid gap-4 pt-4 lg:grid-cols-2">
        {SOAP.map((k) =>
          note[k] ? (
            <div key={k}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">{t(`clinical.soap.${k}`)}</h4>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{note[k]}</p>
            </div>
          ) : null,
        )}
      </CardContent>
      {signed && (
        <div className="space-y-3 border-t border-border bg-surface-2 px-5 py-3">
          <p className="text-xs text-fg-subtle">
            {t('clinical.signed', { date: f.instant(note.signed_at), name: note.author?.name })}
          </p>
          {note.addenda && note.addenda.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t('clinical.addenda')}</h4>
              {note.addenda.map((a) => (
                <Alert key={a.id} tone="info">
                  <p className="whitespace-pre-line">{a.body}</p>
                  <p className="mt-1 text-xs opacity-80">
                    {a.author} · {f.instant(a.created_at)}
                  </p>
                </Alert>
              ))}
            </div>
          )}
          {can('clinical.write') && (
            <div className="flex gap-2">
              <Input placeholder={t('clinical.addendumPlaceholder')} aria-label={t('clinical.addendum')} value={addendum} onChange={(e) => setAddendum(e.target.value)} />
              <Button variant="outline" disabled={!addendum.trim()} loading={addAddendum.isPending} onClick={() => addAddendum.mutate()}>
                {t('clinical.addendum')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
