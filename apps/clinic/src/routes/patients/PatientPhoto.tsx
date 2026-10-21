import { api, unwrap, type Patient } from '@physio/api';
import { Avatar, cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, toast } from '@physio/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, ImageUp, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toastError } from '../../lib/errors';
import { uploadForm } from '../../lib/upload';

/** Patient profile photo with upload / camera / remove (camera opens on phones and tablets). */
export function PatientPhoto({ patient, size = 64, editable = true }: { patient: Patient & { photo_url?: string | null }; size?: number; editable?: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
  const upload = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('photo', file);
      return uploadForm(`/patients/${patient.id}/photo`, body);
    },
    onSuccess: () => {
      toast.success(t('patients.photo.saved'));
      refresh();
    },
    onError: toastError,
  });
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/patients/{patient}/photo', { params: { path: { patient: patient.id } } })),
    onSuccess: refresh,
    onError: toastError,
  });

  const picked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
    e.target.value = '';
  };

  const image = patient.photo_url ? (
    <img src={patient.photo_url} alt={patient.full_name} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <Avatar name={patient.full_name} size={size} />
  );

  if (!editable) return image;

  return (
    <>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={picked} />
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={picked} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn('group relative shrink-0 cursor-pointer rounded-full', upload.isPending && 'animate-pulse')}>
            <span aria-hidden>{image}</span>
            <span className="sr-only">{t('patients.photo.change')}</span>
            <span aria-hidden className="absolute -end-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full border-2 border-surface bg-primary text-primary-fg shadow-sm transition-transform group-hover:scale-110">
              <Camera className="size-3" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => cameraRef.current?.click()}><Camera className="size-4" />{t('patients.photo.take')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}><ImageUp className="size-4" />{t('patients.photo.upload')}</DropdownMenuItem>
          {patient.photo_url && <DropdownMenuItem tone="danger" onSelect={() => remove.mutate()}><Trash2 className="size-4" />{t('patients.photo.remove')}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
