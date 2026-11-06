import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { Suggestion } from '../shared/types';

interface Entry {
  url: string;
  title: string;
  visits: number;
  bookmark?: boolean;
  /** Which browser it was imported from, if any. */
  source?: string;
  last: number;
}

const MAX_ENTRIES = 20000;
const file = () => path.join(app.getPath('userData'), 'history.json');

/**
 * Pages you've visited in Drift plus bookmarks and history imported from
 * other browsers. The address bar searches it for suggestions.
 */
export class HistoryIndex {
  private entries = new Map<string, Entry>();
  private timer?: NodeJS.Timeout;

  constructor() {
    try {
      for (const e of JSON.parse(fs.readFileSync(file(), 'utf8')) as Entry[]) this.entries.set(e.url, e);
    } catch {
      /* first run */
    }
  }

  /** A page finished navigating in Drift. */
  visit(url: string, title: string) {
    if (!/^https?:/i.test(url)) return;
    const e = this.entries.get(url);
    if (e) {
      e.visits++;
      e.last = Date.now();
      if (title && title !== url) e.title = title;
    } else {
      this.entries.set(url, { url, title: title || url, visits: 1, last: Date.now() });
    }
    this.save();
  }

  /** Update the title once the page reports it. */
  title(url: string, title: string) {
    const e = this.entries.get(url);
    if (e && title) {
      e.title = title;
      this.save();
    }
  }

  add(items: { url: string; title: string; visits?: number; bookmark?: boolean }[], source: string) {
    let added = 0;
    for (const it of items) {
      if (!/^https?:/i.test(it.url)) continue;
      const e = this.entries.get(it.url);
      if (e) {
        e.visits = Math.max(e.visits, it.visits ?? 0);
        e.bookmark ||= it.bookmark;
        if (!e.title || e.title === e.url) e.title = it.title;
      } else {
        this.entries.set(it.url, { url: it.url, title: it.title || it.url, visits: it.visits ?? 0, bookmark: it.bookmark, source, last: 0 });
        added++;
      }
    }
    this.trim();
    this.save();
    return added;
  }

  suggest(query: string, limit = 6): Suggestion[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const scored: [number, Entry][] = [];
    for (const e of this.entries.values()) {
      const hay = `${e.title} ${e.url}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) continue;
      let host = '';
      try {
        host = new URL(e.url).hostname.replace(/^www\./, '');
      } catch {
        /* ignore */
      }
      const score =
        (host.startsWith(words[0]) ? 200 : 0) + (e.bookmark ? 80 : 0) + Math.min(e.visits, 200) * 2 + (e.last ? 40 : 0) - e.url.length / 20;
      scored.push([score, e]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, limit).map(([, e]) => ({ url: e.url, title: e.title, kind: e.bookmark ? 'bookmark' : 'history', source: e.source }));
  }

  private trim() {
    if (this.entries.size <= MAX_ENTRIES) return;
    const keep = [...this.entries.values()].sort((a, b) => Number(!!b.bookmark) - Number(!!a.bookmark) || b.visits - a.visits).slice(0, MAX_ENTRIES);
    this.entries = new Map(keep.map((e) => [e.url, e]));
  }

  private save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      try {
        fs.writeFileSync(file(), JSON.stringify([...this.entries.values()]));
      } catch (err) {
        console.error('[drift] failed to save history', err);
      }
    }, 1500);
  }
}
