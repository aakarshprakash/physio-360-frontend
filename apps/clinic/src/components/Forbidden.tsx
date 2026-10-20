import { Button, ErrorState } from '@physio/ui';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function Forbidden() {
  const { t } = useTranslation();
  return (
    <ErrorState
      title={t('common:errors.forbidden')}
      action={
        <Button asChild variant="outline">
          <Link to="/">{t('notFound.home')}</Link>
        </Button>
      }
    />
  );
}
