import { app, net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { BUILT_IN, LOCALES_URL, RTL, sanitizeMessages, translate, type LanguageInfo, type LocaleBundle, type MessageKey, type Messages, type Vars } from '../shared/i18n';

const dir = () => path.join(app.getPath('userData'), 'locales');
const CODE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

/**
 * Drift's language. English and Hebrew are built in; other packs are
 * downloaded from the project's locales/ folder and kept in userData.
 */
export class I18n {
  private code = 'en';
  private messages: Messages = BUILT_IN.en.messages;

  constructor(private setting: () => string) {
    this.reload();
  }

  get system() {
    return app.getLocale().split('-')[0].toLowerCase();
  }

  private installed(code: string) {
    return CODE.test(code) && fs.existsSync(path.join(dir(), `${code}.json`));
  }

  /** Re-read after the language setting changes. */
  reload() {
    const want = this.setting();
    const pick = (c: string) => (BUILT_IN[c] || this.installed(c) ? c : undefined);
    this.code = (want === 'auto' ? pick(this.system) : pick(want)) ?? 'en';
    if (BUILT_IN[this.code]) this.messages = BUILT_IN[this.code].messages;
    else {
      try {
        this.messages = sanitizeMessages(JSON.parse(fs.readFileSync(path.join(dir(), `${this.code}.json`), 'utf8')));
      } catch {
        this.code = 'en';
        this.messages = BUILT_IN.en.messages;
      }
    }
  }

  t = (key: MessageKey, vars?: Vars) => translate(this.messages, key, vars);

  bundle(): LocaleBundle {
    return { code: this.code, dir: RTL.has(this.code) ? 'rtl' : 'ltr', messages: this.messages, system: this.system };
  }

  /** Built-in, downloaded and available-to-download languages. */
  async list(): Promise<{ languages: LanguageInfo[]; offline: boolean }> {
    const map = new Map<string, LanguageInfo>();
    for (const [code, b] of Object.entries(BUILT_IN)) map.set(code, { code, name: b.name, native: b.native, builtIn: true, installed: true });
    let offline = false;
    try {
      const res = await net.fetch(LOCALES_URL + 'index.json');
      if (!res.ok) throw new Error(String(res.status));
      const index = (await res.json()) as { code: string; name: string; native: string }[];
      for (const l of index) {
        if (!CODE.test(l.code) || map.has(l.code)) continue;
        map.set(l.code, { code: l.code, name: String(l.name), native: String(l.native), builtIn: false, installed: this.installed(l.code) });
      }
    } catch {
      offline = true;
    }
    // Downloaded packs stay usable offline.
    if (fs.existsSync(dir())) {
      for (const f of fs.readdirSync(dir())) {
        const code = f.replace(/\.json$/, '');
        if (CODE.test(code) && !map.has(code)) map.set(code, { code, name: code, native: code, builtIn: false, installed: true });
      }
    }
    return { languages: [...map.values()], offline };
  }

  async install(code: string): Promise<boolean> {
    if (!CODE.test(code) || BUILT_IN[code]) return !!BUILT_IN[code];
    try {
      const res = await net.fetch(LOCALES_URL + `${code}.json`);
      if (!res.ok) return false;
      const messages = sanitizeMessages(await res.json());
      if (Object.keys(messages).length === 0) return false;
      fs.mkdirSync(dir(), { recursive: true });
      fs.writeFileSync(path.join(dir(), `${code}.json`), JSON.stringify(messages, null, 1));
      return true;
    } catch {
      return false;
    }
  }
}
