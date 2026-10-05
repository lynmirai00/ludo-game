import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import en from '@/lib/i18n/locales/en';
import viLocale from '@/lib/i18n/locales/vi';
import ja from '@/lib/i18n/locales/ja';
import {
  LANGUAGES,
  createTranslator,
  detectLanguage,
  isPluralForms,
  translate,
  type Locale,
  type MessageKey,
  type PluralForms,
  type StorageLike,
} from '@/lib/i18n';

const LOCALES = { en, vi: viLocale, ja };
type Leaf = string | PluralForms;

// Flattens a locale into { 'dotted.key': stringOrPluralObject }. Plural objects are leaves.
function flatten(node: object, prefix = '', out: Record<string, Leaf> = {}): Record<string, Leaf> {
  for (const [key, value] of Object.entries(node)) {
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' || isPluralForms(value)) out[dotted] = value;
    else if (value && typeof value === 'object') flatten(value, dotted, out);
    else out[dotted] = value as Leaf; // anything else is caught by the value checks below
  }
  return out;
}

function placeholders(value: Leaf | undefined): string[] {
  if (value === undefined) return [];
  const texts = typeof value === 'string' ? [value] : Object.values(value);
  return [...new Set(texts.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!)))].sort();
}

const flat = Object.fromEntries(Object.entries(LOCALES).map(([code, dict]) => [code, flatten(dict)])) as Record<
  keyof typeof LOCALES,
  Record<string, Leaf>
>;

describe('locale files', () => {
  test('there is a locale file for every language in the switcher', () => {
    expect(Object.keys(LANGUAGES).sort()).toEqual(Object.keys(LOCALES).sort());
  });

  for (const code of ['vi', 'ja'] as const) {
    test(`${code} has exactly the same keys as en`, () => {
      const enKeys = Object.keys(flat.en);
      const keys = Object.keys(flat[code]);
      expect(enKeys.filter((k) => !keys.includes(k)), `missing in ${code}`).toEqual([]);
      expect(keys.filter((k) => !enKeys.includes(k)), `extra in ${code}`).toEqual([]);
    });

    test(`${code} placeholders match en`, () => {
      for (const [key, value] of Object.entries(flat.en)) {
        expect(placeholders(flat[code][key]), `${code}:${key}`).toEqual(placeholders(value));
      }
    });
  }

  test('every value is a string or a plural object, and none is empty', () => {
    for (const [code, entries] of Object.entries(flat)) {
      for (const [key, value] of Object.entries(entries)) {
        const texts: unknown[] = typeof value === 'string' ? [value] : isPluralForms(value) ? Object.values(value) : [value];
        for (const text of texts) {
          expect(typeof text, `${code}:${key}`).toBe('string');
          expect((text as string).trim(), `${code}:${key} is empty`).not.toBe('');
        }
      }
    }
  });

  test('every plural object has `other`, and English plurals also have `one`', () => {
    for (const [code, entries] of Object.entries(flat)) {
      for (const [key, value] of Object.entries(entries)) {
        if (!isPluralForms(value)) continue;
        expect(value.other, `${code}:${key} has no "other"`).toBeTruthy();
        if (code === 'en') expect(value.one, `en:${key} has no "one"`).toBeTruthy();
      }
    }
  });

  test('a key is a plural in en exactly when it is a plural in vi and ja', () => {
    for (const [key, value] of Object.entries(flat.en)) {
      for (const code of ['vi', 'ja'] as const) {
        expect(isPluralForms(flat[code][key]), `${code}:${key}`).toBe(isPluralForms(value));
      }
    }
  });
});

describe('translate()', () => {
  const dictionaries = {
    en: { greet: 'Hello {name}', onlyEn: 'English only', bots: { one: '{count} bot', other: '{count} bots' } },
    vi: { greet: 'Xin chào {name}', bots: { other: '{count} máy' } },
    ja: {},
  };
  const tr = createTranslator(dictionaries);

  test('looks up dotted keys and fills placeholders', () => {
    expect(translate('en', 'app.title')).toBe('Ludo');
    expect(translate('vi', 'app.title')).toBe('Cờ cá ngựa');
    expect(translate('ja', 'app.title')).toBe('ルドー');
    expect(tr('vi', 'greet', { name: 'An' })).toBe('Xin chào An');
  });

  test('leaves unknown placeholders untouched', () => {
    expect(tr('en', 'greet')).toBe('Hello {name}');
  });

  test('picks plural forms with Intl.PluralRules', () => {
    expect(tr('en', 'bots', { count: 1 })).toBe('1 bot');
    expect(tr('en', 'bots', { count: 3 })).toBe('3 bots');
    expect(tr('vi', 'bots', { count: 1 })).toBe('1 máy');
  });

  test('formats numbers with Intl.NumberFormat', () => {
    expect(tr('en', 'bots', { count: 1234 })).toBe('1,234 bots');
  });

  test('falls back to English with a warning when a key is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(tr('vi', 'onlyEn')).toBe('English only');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  test('returns the key itself when English is missing too', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(tr('ja', 'no.such.key')).toBe('no.such.key');
    expect(tr('en', 'no.such.key')).toBe('no.such.key');
    expect(translate('en', 'events.rolled')).toBe('events.rolled'); // a group, not a text
    warn.mockRestore();
  });

  test('stats.summary composes plural-aware parts in every language', () => {
    const summary = (lang: string, wins: number, games: number) =>
      translate(lang, 'stats.summary', {
        wins: translate(lang, 'stats.wins', { count: wins }),
        games: translate(lang, 'stats.games', { count: games }),
      });
    expect(summary('en', 1, 1)).toBe('1 win out of 1 game');
    expect(summary('en', 3, 5)).toBe('3 wins out of 5 games');
    expect(summary('vi', 3, 5)).toBe('Thắng 3/5 ván');
    expect(summary('ja', 3, 5)).toBe('5戦3勝');
  });
});

describe('detectLanguage()', () => {
  const storageWith = (value: string | null): StorageLike => ({
    getItem: (key) => (key === 'lang' ? value : null),
    setItem: () => {},
  });

  test("the logged-in player's saved locale wins", () => {
    expect(detectLanguage({ savedLocale: 'ja', storage: storageWith('vi'), languages: ['en'] })).toBe('ja');
  });

  test('then the choice stored on this device', () => {
    expect(detectLanguage({ storage: storageWith('vi'), languages: ['ja-JP'] })).toBe('vi');
  });

  test('then the first supported browser language, comparing only the part before "-"', () => {
    expect(detectLanguage({ languages: ['ja-JP', 'en-US'] })).toBe('ja');
    expect(detectLanguage({ languages: ['fr-FR', 'vi-VN', 'en'] })).toBe('vi');
    expect(detectLanguage({ languages: ['EN-gb'] })).toBe('en');
  });

  test('then English', () => {
    expect(detectLanguage({ languages: ['fr', 'de-DE'] })).toBe('en');
    expect(detectLanguage()).toBe('en');
  });

  test('ignores unsupported saved or stored values', () => {
    expect(detectLanguage({ savedLocale: 'xx', storage: storageWith('fr'), languages: ['vi'] })).toBe('vi');
  });

  test('survives storage that throws', () => {
    const blocked: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    };
    expect(detectLanguage({ storage: blocked, languages: ['ja'] })).toBe('ja');
  });
});

// --- hardcoded text scan ------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, '..');

async function tsxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith('.tsx')).map((e) => path.join(e.parentPath, e.name));
}

// Finds literal JSX text and literal user-facing attributes. Simple on purpose:
// text between `>` and `<` (possibly over several lines) that contains a letter and
// no code characters, so TypeScript generics like useState<T>(x) are not reported.
function findHardcodedText(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const found: string[] = [];
  for (const match of code.matchAll(/>([^<>{}();=]*\p{L}[^<>{}();=]*)</gu)) found.push(match[1]!.trim());
  for (const match of code.matchAll(/\b(aria-label|title|alt|placeholder)\s*=\s*(["'])(.*?)\2/g)) {
    if (match[3]!.trim()) found.push(match[0]);
  }
  return found;
}

describe('no hardcoded user-facing text in components', () => {
  test('the scanner catches planted examples', () => {
    expect(findHardcodedText('<button className="x">Start</button>')).toEqual(['Start']);
    expect(findHardcodedText('<p>\n  New game\n</p>')).toEqual(['New game']);
    expect(findHardcodedText('<select aria-label="Language">')).toEqual(['aria-label="Language"']);
    expect(findHardcodedText('<h1>{t(\'app.title\')}</h1>')).toEqual([]);
    expect(findHardcodedText("const [lang, setLang] = useState<Language | null>(null);")).toEqual([]);
  });

  test('app/ and components/ contain none', async () => {
    const files = [...(await tsxFiles('app')), ...(await tsxFiles('components')), ...(await tsxFiles('lib'))];
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      for (const text of findHardcodedText(await readFile(file, 'utf8'))) {
        offenders.push(`${path.relative(ROOT, file)}: ${text}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('types', () => {
  test('Locale rejects missing or extra keys, and MessageKey rejects unknown keys', () => {
    // @ts-expect-error app.title is missing
    const missing: Locale = { ...viLocale, app: {} };
    // @ts-expect-error app.extra does not exist in en.ts
    const extra: Locale = { ...viLocale, app: { title: 'x', extra: 'y' } };
    const key: MessageKey = 'game.bots';
    // @ts-expect-error not a key in en.ts
    const badKey: MessageKey = 'game.nope';
    // @ts-expect-error a group, not a translation
    const groupKey: MessageKey = 'events.rolled';
    expect([missing, extra, key, badKey, groupKey]).toHaveLength(5);
  });
});

describe('errorKey()', () => {
  test('maps known API error codes and falls back to errors.UNKNOWN', async () => {
    const { errorKey } = await import('@/lib/i18n');
    expect(errorKey('UNAUTHORIZED')).toBe('errors.UNAUTHORIZED');
    expect(errorKey('FORBIDDEN')).toBe('errors.FORBIDDEN');
    expect(errorKey('SOMETHING_NEW')).toBe('errors.UNKNOWN');
    expect(errorKey('constructor')).toBe('errors.UNKNOWN');
  });
});
