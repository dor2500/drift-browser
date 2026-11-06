import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ImportBrowser, ImportSource } from '../shared/types';
import { decodeMozLz4 } from './mozlz4';

export interface ImportedItem {
  url: string;
  title: string;
  visits?: number;
  bookmark?: boolean;
}

export interface ImportedData {
  bookmarks: ImportedItem[];
  /** Top-level items of the bookmarks bar / toolbar, in order. */
  bookmarkBar: ImportedItem[];
  history: ImportedItem[];
  /** Zen only: its spaces and the tabs in them. */
  zen?: {
    spaces: { id: string; name: string }[];
    tabs: { url: string; title: string; favicon?: string; spaceId: string; pinned: boolean; essential: boolean }[];
  };
}

const HOME = os.homedir();
const LOCAL = process.env.LOCALAPPDATA ?? '';
const ROAMING = process.env.APPDATA ?? '';
const MAC = path.join(HOME, 'Library', 'Application Support');
const CONFIG = process.env.XDG_CONFIG_HOME || path.join(HOME, '.config');

/** Where each browser keeps its profiles, per OS. */
const byOs = (win: string, mac: string, linux: string) => (process.platform === 'win32' ? win : process.platform === 'darwin' ? mac : linux);

const CHROMIUM: Record<string, { name: string; dir: string }> = {
  chrome: { name: 'Google Chrome', dir: byOs(path.join(LOCAL, 'Google', 'Chrome', 'User Data'), path.join(MAC, 'Google', 'Chrome'), path.join(CONFIG, 'google-chrome')) },
  brave: {
    name: 'Brave',
    dir: byOs(path.join(LOCAL, 'BraveSoftware', 'Brave-Browser', 'User Data'), path.join(MAC, 'BraveSoftware', 'Brave-Browser'), path.join(CONFIG, 'BraveSoftware', 'Brave-Browser')),
  },
  edge: { name: 'Microsoft Edge', dir: byOs(path.join(LOCAL, 'Microsoft', 'Edge', 'User Data'), path.join(MAC, 'Microsoft Edge'), path.join(CONFIG, 'microsoft-edge')) },
};
const GECKO: Record<string, { name: string; dir: string }> = {
  zen: { name: 'Zen', dir: byOs(path.join(ROAMING, 'zen'), path.join(MAC, 'zen'), path.join(HOME, '.zen')) },
  firefox: { name: 'Firefox', dir: byOs(path.join(ROAMING, 'Mozilla', 'Firefox'), path.join(MAC, 'Firefox'), path.join(HOME, '.mozilla', 'firefox')) },
};

/** Chromium: the last-used profile from "Local State", else Default. */
function chromiumProfile(userData: string): string | undefined {
  if (!fs.existsSync(userData)) return undefined;
  let name = 'Default';
  try {
    const state = JSON.parse(fs.readFileSync(path.join(userData, 'Local State'), 'utf8'));
    name = state?.profile?.last_used || name;
  } catch {
    /* use Default */
  }
  const dir = path.join(userData, name);
  return fs.existsSync(dir) ? dir : undefined;
}

/** Gecko: the profile the installed browser uses ([Install…] Default=), else Default=1, else newest. */
function geckoProfile(root: string): string | undefined {
  const ini = path.join(root, 'profiles.ini');
  if (!fs.existsSync(ini)) return undefined;
  const sections: Record<string, Record<string, string>> = {};
  let cur = '';
  for (const line of fs.readFileSync(ini, 'utf8').split(/\r?\n/)) {
    const sec = line.match(/^\[(.+)\]$/);
    if (sec) sections[(cur = sec[1])] = {};
    else if (cur && line.includes('=')) {
      const i = line.indexOf('=');
      sections[cur][line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  const resolve = (p: string) => (path.isAbsolute(p) ? p : path.join(root, p));
  const install = Object.entries(sections).find(([k, v]) => k.startsWith('Install') && v.Default);
  const candidates = [
    install?.[1].Default,
    ...Object.values(sections).filter((v) => v.Path && v.Default === '1').map((v) => v.Path),
    ...Object.values(sections).filter((v) => v.Path).map((v) => v.Path),
  ].filter((p): p is string => !!p);
  return candidates.map(resolve).find((p) => fs.existsSync(path.join(p, 'places.sqlite')));
}

export function detectSources(): ImportSource[] {
  const out: ImportSource[] = [];
  for (const [id, b] of Object.entries(GECKO)) if (geckoProfile(b.dir)) out.push({ id: id as ImportBrowser, name: b.name, hasSpaces: id === 'zen' });
  for (const [id, b] of Object.entries(CHROMIUM)) if (chromiumProfile(b.dir)) out.push({ id: id as ImportBrowser, name: b.name, hasSpaces: false });
  return out;
}

export function sourceName(id: ImportBrowser) {
  return (GECKO[id] ?? CHROMIUM[id])?.name ?? id;
}

/** Browsers keep their databases locked while running, so read a copy. */
function withCopy<T>(files: string[], fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-import-'));
  try {
    for (const f of files) if (fs.existsSync(f)) fs.copyFileSync(f, path.join(dir, path.basename(f)));
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const isWeb = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//i.test(u);

export function readSource(id: ImportBrowser): ImportedData {
  return id in GECKO ? readGecko(id) : readChromium(id);
}

function readChromium(id: ImportBrowser): ImportedData {
  const profile = chromiumProfile(CHROMIUM[id].dir);
  if (!profile) throw new Error(`${CHROMIUM[id].name} profile not found`);
  const data: ImportedData = { bookmarks: [], bookmarkBar: [], history: [] };

  const bookmarksFile = path.join(profile, 'Bookmarks');
  if (fs.existsSync(bookmarksFile)) {
    type Node = { type?: string; name?: string; url?: string; children?: Node[] };
    const roots = (JSON.parse(fs.readFileSync(bookmarksFile, 'utf8')).roots ?? {}) as Record<string, Node>;
    const walk = (n: Node | undefined) => {
      if (!n) return;
      if (n.type === 'url' && isWeb(n.url)) data.bookmarks.push({ url: n.url, title: n.name || n.url, bookmark: true });
      n.children?.forEach(walk);
    };
    Object.values(roots).forEach(walk);
    for (const n of roots.bookmark_bar?.children ?? []) {
      if (n.type === 'url' && isWeb(n.url)) data.bookmarkBar.push({ url: n.url, title: n.name || n.url, bookmark: true });
    }
  }

  data.history = withCopy([path.join(profile, 'History'), path.join(profile, 'History-wal')], (dir) => {
    if (!fs.existsSync(path.join(dir, 'History'))) return [];
    const db = new DatabaseSync(path.join(dir, 'History'), { readOnly: true });
    try {
      const rows = db
        .prepare("SELECT url, title, visit_count AS visits FROM urls WHERE hidden = 0 AND url LIKE 'http%' ORDER BY visit_count DESC, last_visit_time DESC LIMIT 5000")
        .all() as { url: string; title: string; visits: number }[];
      return rows.map((r) => ({ url: r.url, title: r.title || r.url, visits: Number(r.visits) }));
    } finally {
      db.close();
    }
  });
  return data;
}

function readGecko(id: ImportBrowser): ImportedData {
  const profile = geckoProfile(GECKO[id].dir);
  if (!profile) throw new Error(`${GECKO[id].name} profile not found`);
  const data: ImportedData = { bookmarks: [], bookmarkBar: [], history: [] };

  withCopy([path.join(profile, 'places.sqlite'), path.join(profile, 'places.sqlite-wal')], (dir) => {
    const db = new DatabaseSync(path.join(dir, 'places.sqlite'), { readOnly: true });
    try {
      const bm = db
        .prepare(
          "SELECT b.title AS title, p.url AS url, b.parent AS parent, b.position AS pos FROM moz_bookmarks b JOIN moz_places p ON p.id = b.fk WHERE b.type = 1 AND p.url LIKE 'http%' ORDER BY b.parent, b.position",
        )
        .all() as { title: string | null; url: string; parent: number; pos: number }[];
      const toolbar = (db.prepare("SELECT id FROM moz_bookmarks WHERE guid = 'toolbar_____'").get() as { id: number } | undefined)?.id;
      for (const r of bm) {
        const item = { url: r.url, title: r.title || r.url, bookmark: true };
        data.bookmarks.push(item);
        if (r.parent === toolbar) data.bookmarkBar.push(item);
      }
      const rows = db
        .prepare("SELECT url, title, visit_count AS visits FROM moz_places WHERE visit_count > 0 AND hidden = 0 AND url LIKE 'http%' ORDER BY frecency DESC LIMIT 5000")
        .all() as { url: string; title: string | null; visits: number }[];
      data.history = rows.map((r) => ({ url: r.url, title: r.title || r.url, visits: Number(r.visits) }));
    } finally {
      db.close();
    }
  });

  // Zen keeps spaces, pins and Essentials in its own session file.
  const zenFile = path.join(profile, 'zen-sessions.jsonlz4');
  if (id === 'zen' && fs.existsSync(zenFile)) {
    type ZenTab = {
      entries?: { url?: string; title?: string }[];
      index?: number;
      pinned?: boolean;
      zenEssential?: boolean;
      zenWorkspace?: string;
      zenIsGlance?: boolean;
      zenIsEmpty?: boolean;
      image?: string | null;
    };
    const s = JSON.parse(decodeMozLz4(fs.readFileSync(zenFile))) as { spaces?: { uuid: string; name?: string }[]; tabs?: ZenTab[] };
    const spaces = (s.spaces ?? []).map((sp) => ({ id: sp.uuid, name: sp.name || 'Space' }));
    const tabs = (s.tabs ?? [])
      .filter((t) => !t.zenIsGlance && !t.zenIsEmpty && t.entries?.length)
      .map((t) => {
        const e = t.entries![Math.min(Math.max((t.index ?? t.entries!.length) - 1, 0), t.entries!.length - 1)];
        // Zen saves each tab's favicon; keep web and inline icons only.
        const favicon = typeof t.image === 'string' && /^(https?:|data:image\/)/.test(t.image) ? t.image : undefined;
        return { url: e.url ?? '', title: e.title || e.url || '', favicon, spaceId: t.zenWorkspace ?? spaces[0]?.id ?? '', pinned: !!t.pinned, essential: !!t.zenEssential };
      })
      .filter((t) => isWeb(t.url));
    data.zen = { spaces, tabs };
  }
  return data;
}
