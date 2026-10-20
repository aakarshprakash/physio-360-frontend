import { api, ensureCsrfCookie, openFile, toApiError, type ConsentSignature, type ConsentTemplate, type DocumentFile, type Patient } from '@physio/api';
import { Badge, Button, Card, CardContent, CardHeader, ConfirmDialog, Dialog, DialogContent, EmptyState, Field, Input, Select, SignaturePad, Skeleton, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSignature, FileText, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { unwrap } from '@physio/api';
import { errorMessage, toastError } from '../../../lib/errors';
import { useFormat } from '../../../lib/format';
import { useSession } from '../../../lib/session';

const CATEGORIES = ['report', 'imaging', 'referral', 'prescription', 'insurance', 'other'] as const;

function formatSize(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export function DocumentsTab({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>('report');
  const [uploading, setUploading] = useState(false);

  const { data: docs, isLoading } = useQuery({
    queryKey: ['patient', patient.id, 'documents'],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}/documents', { params: { path: { patient: patient.id } } }))).data as DocumentFile[],
  });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      await ensureCsrfCookie();
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.slice(11) ?? '');
      const body = new FormData();
      body.append('file', file);
      body.append('category', category);
      const res = await fetch(`/api/patients/${patient.id}/documents`, { method: 'POST', body, credentials: 'include', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token } });
      if (!res.ok) throw await toApiError(res);
      toast.success(t('clinical.uploaded'));
      void queryClient.invalidateQueries({ queryKey: ['patient', patient.id, 'documents'] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const remove = useMutation({
    mutationFn: (id: number) => unwrap(api.DELETE('/documents/{document}', { params: { path: { document: id } } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['patient', patient.id, 'documents'] }),
    onError: toastError,
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader
          title={t('clinical.documents')}
          description={t('clinical.maxSize')}
          action={
            can('patients.manage') && (
              <div className="flex gap-2">
                <Select aria-label={t('clinical.category')} className="h-9 w-36 text-[13px]" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{t(`clinical.categories.${c}`)}</option>)}
                </Select>
                <input ref={fileInput} type="file" className="sr-only" id="doc-upload" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <Button size="sm" loading={uploading} onClick={() => fileInput.current?.click()}>
                  <Upload />
                  {t('clinical.upload')}
                </Button>
              </div>
            )
          }
        />
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24" />
          ) : !docs?.length ? (
            <EmptyState icon={<FileText />} title={t('clinical.noDocuments')} />
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-info-soft text-info-soft-fg">
                    <FileText className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <button type="button" className="block max-w-full cursor-pointer truncate text-start text-sm font-medium hover:text-primary hover:underline" onClick={() => openFile(`/documents/${d.id}/download`).catch(toastError)}>
                      {d.original_name}
                    </button>
                    <p className="text-xs text-fg-muted">
                      {t(`clinical.categories.${d.category}`)} · {formatSize(d.size)} · {d.uploaded_by} · {f.instant(d.created_at, 'd MMM yyyy')}
                    </p>
                  </div>
                  {can('patients.manage') && d.category !== 'consent' && (
                    <ConfirmDialog
                      tone="danger"
                      title={t('common:actions.delete')}
                      description={d.original_name}
                      confirmLabel={t('common:actions.delete')}
                      cancelLabel={t('common:actions.cancel')}
                      onConfirm={() => remove.mutateAsync(d.id)}
                      trigger={<Button variant="ghost" size="icon-sm" aria-label={`${t('common:actions.delete')} ${d.original_name}`}><Trash2 /></Button>}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <ConsentsCard patient={patient} />
    </div>
  );
}

function ConsentsCard({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = useSession();
  const [signing, setSigning] = useState<ConsentTemplate | null>(null);

  const { data } = useQuery({
    queryKey: ['patient', patient.id, 'consents'],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}/consents', { params: { path: { patient: patient.id } } })) as unknown as { data: { signed: ConsentSignature[]; pending: ConsentTemplate[] } }).data,
  });

  return (
    <Card>
      <CardHeader title={t('clinical.consents')} />
      <CardContent className="space-y-4">
        {!!data?.pending.length && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-warning">{t('clinical.pendingConsents')}</p>
            {data.pending.map((tpl) => (
              <div key={tpl.id} className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft/50 p-3">
                <FileSignature className="size-5 shrink-0 text-warning" />
                <span className="min-w-0 flex-1 text-sm font-medium">{tpl.title}</span>
                {tpl.is_required && <Badge tone="warning">{t('settings.required')}</Badge>}
                {can('patients.manage') && (
                  <Button size="sm" onClick={() => setSigning(tpl)}>
                    {t('clinical.signConsent')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {data?.signed.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <FileSignature className="size-5 shrink-0 text-success" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{s.title} <span className="text-xs text-fg-subtle">v{s.template_version}</span></p>
              <p className="text-xs text-fg-muted">
                {s.signer_name} ({t(`clinical.relationships.${s.signer_relationship}`)}) · {f.instant(s.signed_at)}
                {s.witness && ` · ${t('clinical.witness', { name: s.witness })}`}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => openFile(`/consent-signatures/${s.id}/image`).catch(toastError)}>
              {t('clinical.signatureLabel')}
            </Button>
          </div>
        ))}
        {data && !data.pending.length && !data.signed.length && <p className="text-sm text-fg-muted">{t('common:empty')}</p>}
      </CardContent>
      {signing && <SignConsentDialog patient={patient} template={signing} onClose={() => setSigning(null)} />}
    </Card>
  );
}

function SignConsentDialog({ patient, template, onClose }: { patient: Patient; template: ConsentTemplate; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [signature, setSignature] = useState<string | null>(null);
  const [signer, setSigner] = useState(patient.full_name);
  const [relationship, setRelationship] = useState('self');

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/patients/{patient}/consents', {
          params: { path: { patient: patient.id } },
          body: { consent_template_id: template.id, signature: signature!, signer_name: signer, signer_relationship: relationship } as never,
        }),
      ),
    onSuccess: () => {
      toast.success(t('clinical.consentSigned'));
      void queryClient.invalidateQueries({ queryKey: ['patient', patient.id, 'consents'] });
      onClose();
    },
    onError: toastError,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={template.title}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button disabled={!signature || !signer.trim()} loading={save.isPending} onClick={() => save.mutate()}>{t('clinical.signConsent')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div tabIndex={0} role="region" aria-label={template.title} dir={template.locale === 'ar' ? 'rtl' : 'ltr'} className="max-h-56 overflow-y-auto whitespace-pre-line rounded-lg border border-border bg-surface-2 p-4 text-sm leading-relaxed">
            {template.body}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('clinical.signerName')} required>
              <Input value={signer} onChange={(e) => setSigner(e.target.value)} />
            </Field>
            <Field label={t('clinical.relationship')}>
              <Select value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                {['self', 'parent', 'guardian', 'spouse', 'other'].map((r) => <option key={r} value={r}>{t(`clinical.relationships.${r}`)}</option>)}
              </Select>
            </Field>
          </div>
          <SignaturePad label={t('clinical.signatureLabel')} hint={t('clinical.signatureHint')} clearLabel={t('common:actions.clear')} onChange={setSignature} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
