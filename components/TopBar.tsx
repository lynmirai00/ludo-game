'use client';

import { useI18n } from '@/lib/i18n/I18nProvider';
import { LanguageSwitcher } from './LanguageSwitcher';

export function TopBar() {
  const { t } = useI18n();

  return (
    <header className="topbar">
      <h1 className="app-title">{t('app.title')}</h1>
      <LanguageSwitcher />
    </header>
  );
}
