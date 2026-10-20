import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError, unwrap } from '@physio/api';
import { Alert, Button, Checkbox, Field, Input, Label } from '@physio/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { errorMessage } from '../../lib/errors';
import { sessionQueryKey, type Session } from '../../lib/session';
import { AuthLayout } from './AuthLayout';

const schema = z.object({ email: z.email(), password: z.string().min(1), remember: z.boolean() });
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', remember: false } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await unwrap(api.POST('/auth/login', { body: values }));
      queryClient.setQueryData(sessionQueryKey, (result as unknown as { data: Session }).data);
      const next = params.get('next');
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? (e.fieldError('email') ?? e.message) : errorMessage(e));
    }
  });

  return (
    <AuthLayout title={t('auth.title')} subtitle={t('auth.subtitle')}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={t('auth.email')} error={form.formState.errors.email && t('common:errors.required')} required>
          <Input type="email" autoComplete="username" autoFocus {...form.register('email')} />
        </Field>
        <Field label={t('auth.password')} error={form.formState.errors.password && t('common:errors.required')} required>
          <Input type="password" autoComplete="current-password" {...form.register('password')} />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Checkbox id="remember" checked={form.watch('remember')} onCheckedChange={(v) => form.setValue('remember', v === true)} />
            <Label htmlFor="remember" className="font-normal text-fg-muted">
              {t('auth.remember')}
            </Label>
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          {t('auth.submit')}
        </Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            {t('auth.forgot')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
