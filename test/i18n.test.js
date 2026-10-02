import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import en from '../public/js/locales/en.js';
import vi from '../public/js/locales/vi.js';
import ja from '../public/js/locales/ja.js';
import {
  LANGUAGES,
  createTranslator,
  detectLanguage,
  getLanguage,
  isPluralForms,
  onLanguageChange,
  setLanguage,
  t,
} from '../public/js/i18n.js';

const LOCALES = { en, vi, ja };

// Flattens a locale into { 'dotted.key': stringOrPluralObject }. Plural objects are leaves.
function flatten(node, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' || isPluralForms(value)) out[path] = value;
    else if (value && typeof value === 'object') flatten(value, path, out);
    else out[path] = value;
  }
  return out;
}

function placeholders(value) {
  const texts = typeof value === 'string' ? [value] : Object.values(value);
  return [...new Set(texts.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();
}

const flat = Object.fromEntries(Object.entries(LOCALES).map(([code, dict]) => [code, flatten(dict)]));

describe('locale files', () => {
  test('there is a locale file for every language in the switcher', () => {
    assert.deepEqual(Object.keys(LANGUAGES).sort(), Object.keys(LOCALES).sort());
  });

  for (const code of ['vi', 'ja']) {
    test(`${code} has exactly the same keys as en`, () => {
      const enKeys = Object.keys(flat.en);
      const keys = Object.keys(flat[code]);
      assert.deepEqual(enKeys.filter((k) => !keys.includes(k)), [], `missing in ${code}`);
      assert.deepEqual(keys.filter((k) => !enKeys.includes(k)), [], `extra in ${code}`);
    });

    test(`${code} placeholders match en`, () => {
      for (const [key, value] of Object.entries(flat.en)) {
        assert.deepEqual(placeholders(flat[code][key]), placeholders(value), `placeholders differ for ${code}:${key}`);
      }
    });
  }

  test('every value is a string or a plural object, and none is empty', () => {
    for (const [code, entries] of Object.entries(flat)) {
      for (const [key, value] of Object.entries(entries)) {
        const texts = typeof value === 'string' ? [value] : isPluralForms(value) ? Object.values(value) : [value];
        for (const text of texts) {
          assert.equal(typeof text, 'string', `${code}:${key} is not a string`);
          assert.notEqual(text.trim(), '', `${code}:${key} is empty`);
        }
      }
    }
  });

  test('every plural object has `other`, and English plurals also have `one`', () => {
    for (const [code, entries] of Object.entries(flat)) {
      for (const [key, value] of Object.entries(entries)) {
        if (!isPluralForms(value)) continue;
        assert.ok(value.other, `${code}:${key} has no "other" form`);
        if (code === 'en') assert.ok(value.one, `en:${key} has no "one" form`);
      }
    }
  });

  test('a key is a plural in en exactly when it is a plural in vi and ja', () => {
    for (const [key, value] of Object.entries(flat.en)) {
      for (const code of ['vi', 'ja']) {
        assert.equal(isPluralForms(flat[code][key]), isPluralForms(value), `${code}:${key}`);
      }
    }
  });
});

describe('t()', () => {
  const dictionaries = {
    en: { greet: 'Hello {name}', onlyEn: 'English only', bots: { one: '{count} bot', other: '{count} bots' } },
    vi: { greet: 'Xin chào {name}', bots: { other: '{count} máy' } },
    ja: {},
  };
  const translate = createTranslator(dictionaries);

  test('looks up dotted keys and fills placeholders', () => {
    assert.equal(t('app.title'), 'Ludo');
    assert.equal(translate('vi', 'greet', { name: 'An' }), 'Xin chào An');
  });

  test('leaves unknown placeholders untouched', () => {
    assert.equal(translate('en', 'greet'), 'Hello {name}');
  });

  test('picks plural forms with Intl.PluralRules', () => {
    assert.equal(translate('en', 'bots', { count: 1 }), '1 bot');
    assert.equal(translate('en', 'bots', { count: 3 }), '3 bots');
    assert.equal(translate('vi', 'bots', { count: 1 }), '1 máy');
  });

  test('formats numbers with Intl.NumberFormat', () => {
    assert.equal(translate('en', 'bots', { count: 1234 }), '1,234 bots');
  });

  test('falls back to English with a warning when a key is missing', (ctx) => {
    const warn = ctx.mock.method(console, 'warn', () => {});
    assert.equal(translate('vi', 'onlyEn'), 'English only');
    assert.equal(warn.mock.callCount(), 1);
  });

  test('returns the key itself when English is missing too', (ctx) => {
    ctx.mock.method(console, 'warn', () => {});
    assert.equal(translate('ja', 'no.such.key'), 'no.such.key');
    assert.equal(translate('en', 'no.such.key'), 'no.such.key');
  });

  test('a key that points to a group, not a text, returns the key', (ctx) => {
    ctx.mock.method(console, 'warn', () => {});
    assert.equal(t('events.rolled'), 'events.rolled');
  });

  test('stats.summary composes plural-aware parts in every language', () => {
    const summary = (lang, wins, games) => {
      setLanguage(lang);
      return t('stats.summary', { wins: t('stats.wins', { count: wins }), games: t('stats.games', { count: games }) });
    };
    assert.equal(summary('en', 1, 1), '1 win out of 1 game');
    assert.equal(summary('en', 3, 5), '3 wins out of 5 games');
    assert.equal(summary('vi', 3, 5), 'Thắng 3/5 ván');
    assert.equal(summary('ja', 3, 5), '5戦3勝');
    setLanguage('en');
  });
});

describe('setLanguage()', () => {
  test('switches language and notifies listeners', () => {
    const seen = [];
    const off = onLanguageChange((lang) => seen.push(lang));
    setLanguage('ja');
    assert.equal(getLanguage(), 'ja');
    assert.equal(t('app.title'), 'ルドー');
    setLanguage('vi');
    assert.equal(t('app.title'), 'Cờ cá ngựa');
    off();
    setLanguage('en');
    assert.deepEqual(seen, ['ja', 'vi']);
  });

  test('an unsupported code falls back to English', () => {
    setLanguage('fr');
    assert.equal(getLanguage(), 'en');
  });
});

describe('detectLanguage()', () => {
  const storageWith = (value) => ({ getItem: (key) => (key === 'lang' ? value : null) });

  test("the logged-in player's saved locale wins", () => {
    assert.equal(detectLanguage({ savedLocale: 'ja', storage: storageWith('vi'), languages: ['en'] }), 'ja');
  });

  test('then the choice stored on this device', () => {
    assert.equal(detectLanguage({ storage: storageWith('vi'), languages: ['ja-JP'] }), 'vi');
  });

  test('then the first supported browser language, comparing only the part before "-"', () => {
    assert.equal(detectLanguage({ languages: ['ja-JP', 'en-US'] }), 'ja');
    assert.equal(detectLanguage({ languages: ['fr-FR', 'vi-VN', 'en'] }), 'vi');
    assert.equal(detectLanguage({ languages: ['EN-gb'] }), 'en');
  });

  test('then English', () => {
    assert.equal(detectLanguage({ languages: ['fr', 'de-DE'] }), 'en');
    assert.equal(detectLanguage(), 'en');
  });

  test('ignores unsupported saved or stored values', () => {
    assert.equal(detectLanguage({ savedLocale: 'xx', storage: storageWith('fr'), languages: ['vi'] }), 'vi');
  });

  test('survives storage that throws', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); } };
    assert.equal(detectLanguage({ storage: blocked, languages: ['ja'] }), 'ja');
  });
});

describe('no hardcoded text in index.html', () => {
  const htmlPromise = readFile(new URL('../public/index.html', import.meta.url), 'utf8').then((html) =>
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script\b[\s\S]*?<\/script>/gi, (m) => m.replace(/>[\s\S]*<\//, '></'))
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/<!doctype[^>]*>/i, ''),
  );

  test('every text node sits directly inside a data-i18n element', async () => {
    const html = await htmlPromise;
    const offenders = [];
    for (const [, closing, tag, attrs, text] of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)([^>]*)>([^<]*)/gi)) {
      if (!text.trim()) continue;
      if (closing || !/\bdata-i18n=/.test(attrs)) offenders.push(`<${closing}${tag}> ${text.trim()}`);
    }
    assert.deepEqual(offenders, []);
  });

  test('no hardcoded user-facing attributes (use data-i18n-* instead)', async () => {
    const html = await htmlPromise;
    const found = [...html.matchAll(/\s(aria-label|title|alt|placeholder)\s*=\s*"([^"]*)"/gi)].filter(([, , v]) => v.trim());
    assert.deepEqual(found.map((m) => m[0].trim()), []);
  });
});
