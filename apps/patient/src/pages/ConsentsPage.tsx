import { api, unwrap, type ConsentTemplate } from '@physio/api';
import { Button, Card, Checkbox, EmptyState, Field, Input, Label, PageHeader, SignaturePad, Skeleton, toast } from '@physio/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, FileSignature } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMyConsents } from '../lib/data';
import { useFormat, useSession } from '../lib/session';
import { errorText } from './util';

export function ConsentsPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const { data, isLoading } = useMyConsents();

  return (
    <div className="space-y-5">
      <PageHeader title={t('consents.title')} />
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : !data?.pending.length ? (
        <Card><EmptyState icon={<FileCheck2 />} title={t('consents.none')} /></Card>
      ) : (
        data.pending.map((tpl) => <ConsentForm key={tpl.id} template={tpl} />)
      )}
      {!!data?.signed.length && (
        <section>
          <h2 className="mb-2 font-semibold">{t('consents.signed')}</h2>
          <ul className="space-y-2">
            {data.signed.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-sm">
                <FileSignature className="size-5 text-success" />
                <span className="flex-1 font-medium">{s.title}</span>
                <span className="text-xs text-fg-muted">{f.instant(s.signed_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ConsentForm({ template }: { template: ConsentTemplate }) {
  const { t } = useTranslation();
  const { patient } = useSession();
  const client = useQueryClient();
  const [name, setName] = useState(patient.full_name);
  const [agree, setAgree] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const sign = useMutation({
    mutationFn: () => unwrap(api.POST('/patient/consents/{template}/sign', { params: { path: { template: template.id } }, body: { signature: signature!, signer_name: name, agree } as never })),
    onSuccess: () => {
      toast.success(t('consents.done'));
      void client.invalidateQueries({ queryKey: ['my', 'consents'] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Card className="space-y-4 p-4">
      <h2 className="font-semibold">{template.title}</h2>
      <div tabIndex={0} role="region" aria-label={template.title} dir={template.locale === 'ar' ? 'rtl' : 'ltr'} className="max-h-60 overflow-y-auto whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">{template.body}</div>
      <div className="flex items-start gap-2.5">
        <Checkbox id={`agree-${template.id}`} checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
        <Label htmlFor={`agree-${template.id}`} className="font-normal">{t('consents.agree')}</Label>
      </div>
      <Field label={t('consents.name')}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <SignaturePad label={t('consents.signature')} hint={t('consents.signatureHint')} clearLabel={t('common:actions.clear')} onChange={setSignature} />
      <Button size="lg" className="w-full" disabled={!agree || !signature || !name.trim()} loading={sign.isPending} onClick={() => sign.mutate()}>{t('consents.sign')}</Button>
    </Card>
  );
}
