import { LANGUAGES, detectLanguage, getLanguage, onLanguageChange, saveLanguage, setLanguage } from './i18n.js';

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function setUpLanguageSwitcher() {
  const select = document.getElementById('lang-select');
  for (const [code, name] of Object.entries(LANGUAGES)) {
    const option = document.createElement('option');
    option.value = code;
    option.lang = code;
    option.textContent = name;
    select.append(option);
  }

  onLanguageChange((lang) => {
    select.value = lang;
  });

  select.addEventListener('change', () => {
    setLanguage(select.value);
    saveLanguage(getLanguage(), getStorage());
  });
}

setUpLanguageSwitcher();
setLanguage(detectLanguage({ storage: getStorage(), languages: navigator.languages }));
