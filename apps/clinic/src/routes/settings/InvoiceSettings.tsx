import { api, ApiError, unwrap, type Tenant } from '@physio/api';
import { Alert, Button, Card, CardContent, CardHeader, Field, Input, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageUp, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage, toastError } from '../../lib/errors';
import { useSession } from '../../lib/session';
import { uploadForm } from '../../lib/upload';

type InvoiceSettings = { terms: string | null; footer_note: string | null; bank_details: string | null; upi_id: string | null; signatory: string | null; accent_color: string | null };

/** Letterhead logo and what prints on every invoice. */
export function InvoiceSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { refresh } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: clinic } = useQuery({ queryKey: ['clinic'], queryFn: async () => (await unwrap(api.GET('/settings/clinic'))).data as Tenant });
  const [draft, setDraft] = useState<InvoiceSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSaved = (r: unknown) => {
    queryClient.setQueryData(['clinic'], (r as { data: Tenant }).data);
    void refresh();
  };
  const save = useMutation({
    mutationFn: (invoice: InvoiceSettings) => unwrap(api.PUT('/settings/clinic', { body: { settings: { invoice } } as never })),
    onSuccess: (r) => {
      onSaved(r);
      setDraft(null);
      setError(null);
      toast.success(t('settings.saved'));
    },
    onError: (e) => setError(e instanceof ApiError && e.isValidation ? Object.values(e.errors)[0]?.[0] ?? errorMessage(e) : errorMessage(e)),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('logo', file);
      return uploadForm('/settings/clinic/logo', body);
    },
    onSuccess: (r) => {
      onSaved(r);
      toast.success(t('invoiceSettings.logoSaved'));
    },
    onError: toastError,
  });
  const removeLogo = useMutation({
    mutationFn: () => unwrap(api.DELETE('/settings/clinic/logo')),
    onSuccess: onSaved,
    onError: toastError,
  });

  if (!clinic) return null;
  const saved = (clinic.settings as unknown as { invoice: InvoiceSettings }).invoice;
  const v = draft ?? saved;
  const set = (k: keyof InvoiceSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft({ ...v, [k]: e.target.value || null });
  const logoUrl = (clinic as unknown as { logo_url?: string | null }).logo_url;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={t('invoiceSettings.letterhead')} description={t('invoiceSettings.letterheadHelp')} />
        <CardContent className="flex flex-wrap items-center gap-5">
          <div className="grid size-28 place-items-center overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface-2">
            {logoUrl ? <img src={logoUrl} alt={t('invoiceSettings.logo')} className="max-h-24 max-w-24 object-contain" /> : <ImageUp className="size-7 text-fg-subtle" />}
          </div>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
            <div className="flex gap-2">
              <Button variant="outline" loading={upload.isPending} onClick={() => fileRef.current?.click()}><ImageUp />{logoUrl ? t('invoiceSettings.replaceLogo') : t('invoiceSettings.uploadLogo')}</Button>
              {logoUrl && <Button variant="danger-ghost" loading={removeLogo.isPending} onClick={() => removeLogo.mutate()}><Trash2 />{t('common:actions.delete')}</Button>}
            </div>
            <p className="text-xs text-fg-muted">{t('invoiceSettings.logoHint')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('invoiceSettings.title')} description={t('invoiceSettings.subtitle')} />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
          <Field label={t('invoiceSettings.upi')} hint={t('invoiceSettings.upiHint')}><Input value={v.upi_id ?? ''} onChange={set('upi_id')} placeholder="clinic@okhdfcbank" /></Field>
          <Field label={t('invoiceSettings.signatory')}><Input value={v.signatory ?? ''} onChange={set('signatory')} placeholder={t('invoiceSettings.signatoryPlaceholder')} /></Field>
          <Field label={t('invoiceSettings.bank')} className="sm:col-span-2"><Textarea rows={2} value={v.bank_details ?? ''} onChange={set('bank_details')} placeholder={'HDFC Bank, MG Road\nA/c 5020… · IFSC HDFC000…'} /></Field>
          <Field label={t('invoiceSettings.terms')} className="sm:col-span-2"><Textarea rows={3} value={v.terms ?? ''} onChange={set('terms')} /></Field>
          <Field label={t('invoiceSettings.footer')}><Input value={v.footer_note ?? ''} onChange={set('footer_note')} placeholder={t('invoiceSettings.footerPlaceholder')} /></Field>
          <Field label={t('invoiceSettings.accent')}><Input type="color" className="h-10 w-20 p-1" value={v.accent_color ?? '#2F7D66'} onChange={set('accent_color')} /></Field>
          <div className="flex justify-end sm:col-span-2"><Button loading={save.isPending} disabled={!draft} onClick={() => save.mutate(v)}>{t('common:actions.saveChanges')}</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
