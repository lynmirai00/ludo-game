'use client';

import { LANGUAGES, isSupported } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/I18nProvider';

export function LanguageSwitcher() {
  const { lang, t, setLanguage } = useI18n();

  return (
    <select
      className="lang-select"
      aria-label={t('lang.label')}
      value={lang}
      onChange={(event) => {
        if (isSupported(event.target.value)) setLanguage(event.target.value);
      }}
    >
      {Object.entries(LANGUAGES).map(([code, name]) => (
        <option key={code} value={code} lang={code}>
          {name}
        </option>
      ))}
    </select>
  );
}
