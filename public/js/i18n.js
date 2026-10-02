// Translation, language detection and language switching.
// Importing this module never touches the DOM, so it can be tested in Node.
import en from './locales/en.js';
import vi from './locales/vi.js';
import ja from './locales/ja.js';

// Names are always shown in their own language, never translated.
export const LANGUAGES = { en: 'English', vi: 'Tiếng Việt', ja: '日本語' };
export const DEFAULT_LANGUAGE = 'en';
export const STORAGE_KEY = 'lang';

const DICTIONARIES = { en, vi, ja };
const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

export function isSupported(code) {
  return Object.hasOwn(LANGUAGES, code);
}

// A plural value is an object whose keys are all Intl.PluralRules categories,
// e.g. { one: '{count} bot', other: '{count} bots' }. Note that { self, other }
// event objects are NOT plurals, because `self` is not a category.
export function isPluralForms(value) {
  if (!value || typeof value !== 'object') return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => PLURAL_CATEGORIES.has(k) && typeof value[k] === 'string');
}

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dict);
}

function isTranslation(value) {
  return typeof value === 'string' || isPluralForms(value);
}

function interpolate(text, params, lang) {
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    if (!Object.hasOwn(params, name)) return match;
    const value = params[name];
    return typeof value === 'number' ? new Intl.NumberFormat(lang).format(value) : String(value);
  });
}

// Builds a translate(lang, key, params) function over the given dictionaries.
// Missing key → English (with a warning) → the key itself.
export function createTranslator(dictionaries) {
  return function translate(lang, key, params = {}) {
    let value = lookup(dictionaries[lang], key);
    if (!isTranslation(value) && lang !== DEFAULT_LANGUAGE) {
      value = lookup(dictionaries[DEFAULT_LANGUAGE], key);
      if (isTranslation(value)) console.warn(`i18n: missing "${key}" in "${lang}", using English`);
    }
    if (!isTranslation(value)) return key;

    if (isPluralForms(value)) {
      const category = new Intl.PluralRules(lang).select(Number(params.count ?? 0));
      value = value[category] ?? value.other ?? '';
    }
    return interpolate(value, params, lang);
  };
}

const translate = createTranslator(DICTIONARIES);

let currentLanguage = DEFAULT_LANGUAGE;
const listeners = new Set();

export function t(key, params) {
  return translate(currentLanguage, key, params);
}

export function getLanguage() {
  return currentLanguage;
}

// Picks the UI language, first match wins:
// 1. the logged-in player's saved locale, 2. the choice stored on this device,
// 3. the first supported browser language (only the part before '-'), 4. English.
export function detectLanguage({ savedLocale, storage, languages } = {}) {
  if (isSupported(savedLocale)) return savedLocale;

  let stored = null;
  try {
    stored = storage?.getItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked (private mode, privacy settings); just skip it.
  }
  if (isSupported(stored)) return stored;

  for (const tag of languages ?? []) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (isSupported(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

export function saveLanguage(code, storage) {
  try {
    storage?.setItem(STORAGE_KEY, code);
  } catch {
    // Not fatal: the language just won't be remembered on this device.
  }
}

// Fills static HTML: data-i18n sets the text, data-i18n-aria-label sets aria-label.
export function applyTranslations(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-aria-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  }
}

// Switches language and notifies every listener so each part of the UI re-renders.
// Never reloads the page, so a running game is not interrupted.
export function setLanguage(code) {
  currentLanguage = isSupported(code) ? code : DEFAULT_LANGUAGE;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLanguage;
    applyTranslations(document);
    document.title = t('app.title');
  }
  for (const listener of listeners) listener(currentLanguage);
}

// Returns a function that removes the listener.
export function onLanguageChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
