import { beforeEach, describe, expect, it } from 'vitest';
import { DICTIONARIES, LOCALES, isRtl, matchLocale, setLocale, t, type Locale } from '../src/i18n';
import en from '../src/i18n/locales/en';
import { messageBody } from '../src/ui/chat';

describe('i18n', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <h1 data-i18n="app.title"></h1>
      <textarea data-i18n-placeholder="chat.placeholder"></textarea>
      <select data-i18n-aria-label="settings.language"></select>`;
    setLocale('en');
  });

  it('switches dir to rtl for Persian and Arabic, and back to ltr for the others', () => {
    const html = document.documentElement;
    const expected: Array<[Locale, 'rtl' | 'ltr']> = [
      ['fa', 'rtl'],
      ['en', 'ltr'],
      ['ar', 'rtl'],
      ['ru', 'ltr'],
      ['es', 'ltr'],
    ];
    for (const [locale, dir] of expected) {
      setLocale(locale);
      expect(html.dir, locale).toBe(dir);
      expect(html.lang).toBe(locale);
    }
  });

  it('retranslates text, placeholders and aria labels on switch', () => {
    setLocale('ar');
    expect(document.querySelector('h1')!.textContent).toBe(DICTIONARIES.ar['app.title']);
    expect(document.querySelector('textarea')!.getAttribute('placeholder')).toBe(DICTIONARIES.ar['chat.placeholder']);
    expect(document.querySelector('select')!.getAttribute('aria-label')).toBe(DICTIONARIES.ar['settings.language']);
  });

  it('derives direction from region-tagged language codes', () => {
    expect(isRtl('fa-IR')).toBe(true);
    expect(isRtl('ar_EG')).toBe(true);
    expect(isRtl('he')).toBe(true);
    expect(isRtl('en-US')).toBe(false);
    expect(isRtl('ru')).toBe(false);
  });

  it('picks the first supported browser language, else English', () => {
    expect(matchLocale(['de-DE', 'fa-IR', 'en'])).toBe('fa');
    expect(matchLocale(['de', 'fr'])).toBe('en');
    expect(matchLocale(['constructor'])).toBe('en');
  });

  it('fills {placeholders}', () => {
    setLocale('ru');
    expect(t('err.http', { status: 503 })).toBe('Сервер модели вернул ошибку (503).');
  });

  it('ships every UI key in every locale, non-empty, without em-dashes, placeholders intact', () => {
    const keys = Object.keys(en).sort();
    for (const [code, dict] of Object.entries(DICTIONARIES) as Array<[Locale, Record<string, string>]>) {
      expect(Object.keys(dict).sort(), code).toEqual(keys);
      for (const key of keys) {
        const value = dict[key]!;
        expect(value.trim(), `${code}:${key}`).not.toBe('');
        expect(value, `${code}:${key}`).not.toMatch(/\u2014/);
        const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
        expect(vars(value), `${code}:${key}`).toEqual(vars(en[key as keyof typeof en]));
      }
    }
  });

  it('gives chat messages their own direction, independent of an RTL UI', () => {
    setLocale('fa');
    const body = messageBody('Hello, world. <b>not markup</b>');
    expect(body.getAttribute('dir')).toBe('auto');
    expect(body.innerHTML).not.toContain('<b>');
  });

  it('marks every non-English locale as machine-drafted', () => {
    for (const code of Object.keys(LOCALES) as Locale[]) {
      expect(LOCALES[code].machineDrafted, code).toBe(code !== 'en');
    }
  });
});
