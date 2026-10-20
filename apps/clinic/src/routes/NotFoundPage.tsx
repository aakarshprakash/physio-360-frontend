import { Button, EmptyState } from '@physio/ui';
import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<Compass />}
      title={t('notFound.title')}
      description={t('notFound.text')}
      action={<Button asChild><Link to="/">{t('notFound.home')}</Link></Button>}
    />
  );
}
