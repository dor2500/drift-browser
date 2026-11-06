import { useEffect, useMemo, useRef, useState } from 'react';
import type { BrowserState, Suggestion, TabState } from '../../shared/types';
import { COLOR_THEMES } from '../../shared/colorThemes';
import { translate } from '../../shared/i18n';
import { SEARCH_ENGINES } from '../../shared/settings';
import { displayUrl, looksLikeUrl } from '../../shared/url';
import { cmd, cx } from '../lib';
import { Favicon } from './Favicon';
import { Icon } from './Icon';
import type { Anchor } from './TopBar';
import { t } from '../i18n';

type Action = { id: string; label: string; en: string; run: () => void };
type Item = { kind: 'go'; input: string } | { kind: 'action'; a: Action } | { kind: 'suggest'; s: Suggestion } | { kind: 'tab'; tab: TabState };

interface Props {
  mode: 'new' | 'current';
  state: BrowserState;
  /** Drop down from this omnibox rectangle instead of floating mid-screen. */
  anchor?: Anchor;
  onClose: () => void;
}

/** Zen's floating URL bar: type a URL or search, or jump to an open tab. */
export function CommandBar({ mode, state, anchor, onClose }: Props) {
  const active = state.tabs.find((t) => t.id === (state.glance?.id ?? state.activeTabId));
  const navigateCurrent = mode === 'current' && !!active;
  const [q, setQ] = useState(navigateCurrent ? active!.url : '');
  const [sel, setSel] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const input = useRef<HTMLInputElement>(null);

  // Bookmarks and history (Drift's own plus imported) matching what you type.
  useEffect(() => {
    const s = q.trim();
    if (!s || (navigateCurrent && s === active?.url)) {
      setSuggestions([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => void window.drift.suggest(s).then((r) => alive && setSuggestions(r)), 60);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, navigateCurrent, active?.url]);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  // Things you can do by typing their name, like Arc's and Vivaldi's command bars.
  const actions = useMemo<Action[]>(() => {
    const id = active?.id;
    const list: Action[] = [
      { id: 'find', label: t('act.find'), en: translate({}, 'act.find'), run: () => setTimeout(() => window.dispatchEvent(new CustomEvent('drift:find')), 50) },
      { id: 'downloads', label: t('act.downloads'), en: translate({}, 'act.downloads'), run: () => window.drift.downloadsMenu() },
      { id: 'zoomin', label: t('act.zoomIn'), en: translate({}, 'act.zoomIn'), run: () => cmd({ type: 'zoom', dir: 1 }) },
      { id: 'zoomout', label: t('act.zoomOut'), en: translate({}, 'act.zoomOut'), run: () => cmd({ type: 'zoom', dir: -1 }) },
      { id: 'zoomreset', label: t('act.zoomReset'), en: translate({}, 'act.zoomReset'), run: () => cmd({ type: 'zoom', dir: 0 }) },
      { id: 'print', label: t('act.print'), en: translate({}, 'act.print'), run: () => cmd({ type: 'page:print' }) },
      { id: 'shot', label: t('act.screenshot'), en: translate({}, 'act.screenshot'), run: () => cmd({ type: 'page:screenshot' }) },
      { id: 'translate', label: t('act.translate'), en: translate({}, 'act.translate'), run: () => cmd({ type: 'page:translate' }) },
      { id: 'source', label: t('act.source'), en: translate({}, 'act.source'), run: () => cmd({ type: 'page:source' }) },
      { id: 'pip', label: t('act.pip'), en: translate({}, 'act.pip'), run: () => cmd({ type: 'page:pip' }) },
      { id: 'split', label: t('act.split'), en: translate({}, 'act.split'), run: () => cmd({ type: 'split:toggle' }) },
      { id: 'compact', label: t('act.compact'), en: translate({}, 'act.compact'), run: () => cmd({ type: 'ui:compact' }) },
      { id: 'vertical', label: t('act.vertical'), en: translate({}, 'act.vertical'), run: () => cmd({ type: 'settings:set', patch: { verticalTabs: !state.settings.verticalTabs } }) },
      { id: 'reopen', label: t('menu.reopen'), en: translate({}, 'menu.reopen'), run: () => cmd({ type: 'tab:reopen' }) },
      { id: 'newspace', label: t('menu.newSpace'), en: translate({}, 'menu.newSpace'), run: () => cmd({ type: 'space:new' }) },
      { id: 'settings', label: t('menu.settings'), en: translate({}, 'menu.settings'), run: () => cmd({ type: 'settings:open' }) },
      { id: 'google', label: t('act.google'), en: translate({}, 'act.google'), run: () => cmd({ type: 'google:signin' }) },
      ...COLOR_THEMES.map((c) => ({
        id: `theme-${c.id}`,
        label: t('act.theme', { name: c.name }),
        en: translate({}, 'act.theme', { name: c.name }),
        run: () => cmd({ type: 'settings:set', patch: { colorTheme: c.id, spaceColors: false } }),
      })),
    ];
    if (id) {
      list.push(
        { id: 'pin', label: t('act.pin'), en: translate({}, 'act.pin'), run: () => active && cmd({ type: 'tab:set', id, pinned: !active.pinned }) },
        { id: 'mute', label: t('act.mute'), en: translate({}, 'act.mute'), run: () => active && cmd({ type: 'tab:set', id, muted: !active.muted }) },
      );
    }
    return list;
  }, [active, state.settings.verticalTabs]);

  const items = useMemo<Item[]>(() => {
    const raw = q.trim();
    const actionMode = raw.startsWith('>');
    const s = actionMode ? raw.slice(1).trim() : raw;
    const needle = s.toLowerCase();
    const matching = actions.filter((a) => needle && (a.label.toLowerCase().includes(needle) || a.en.toLowerCase().includes(needle)));
    if (actionMode) return (needle ? matching : actions).slice(0, 12).map((a) => ({ kind: 'action' as const, a }));
    const out: Item[] = s ? [{ kind: 'go', input: s }] : [];
    if (needle.length >= 3) for (const a of matching.slice(0, 3)) out.push({ kind: 'action', a });
    const open = new Set(state.tabs.map((t) => t.url));
    for (const sg of suggestions) if (!open.has(sg.url)) out.push({ kind: 'suggest', s: sg });
    const tabs = state.tabs
      .filter((t) => t.id !== state.activeTabId && !t.glanceOf)
      .filter((t) => !needle || t.title.toLowerCase().includes(needle) || t.url.toLowerCase().includes(needle))
      .slice(0, 5);
    for (const tab of tabs) out.push({ kind: 'tab', tab });
    return out;
  }, [q, state.tabs, state.activeTabId, suggestions, actions]);

  useEffect(() => setSel(0), [q]);

  const choose = (it: Item | undefined) => {
    if (!it) return;
    if (it.kind === 'action') it.a.run();
    else if (it.kind === 'tab') cmd({ type: 'tab:activate', id: it.tab.id });
    else {
      const target = it.kind === 'go' ? it.input : it.s.url;
      if (navigateCurrent) cmd({ type: 'tab:navigate', input: target });
      else cmd({ type: 'tab:new', url: target });
    }
    onClose();
  };

  const spaceName = (id: string) => state.spaces.find((s) => s.id === id)?.name ?? '';

  return (
    <div className={cx('commandbar-backdrop', anchor && 'anchored')} onMouseDown={onClose}>
      <div
        className="commandbar"
        style={anchor ? { left: anchor.left - 36, top: anchor.top - 4, width: anchor.width + 44 } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="commandbar-input">
          <Icon name="search" size={18} />
          <input
            ref={input}
            value={q}
            spellCheck={false}
            placeholder={navigateCurrent ? t('url.placeholder') : t('bar.placeholderNew')}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'Enter') choose(items[sel]);
              else if (e.key === 'ArrowDown') setSel((i) => Math.min(items.length - 1, i + 1));
              else if (e.key === 'ArrowUp') setSel((i) => Math.max(0, i - 1));
              else return;
              e.preventDefault();
            }}
          />
        </div>
        <div className="commandbar-results">
          {items.map((it, i) => (
            <div
              key={it.kind === 'go' ? 'go' : it.kind === 'action' ? `a:${it.a.id}` : it.kind === 'suggest' ? `s:${it.s.url}` : it.tab.id}
              className={cx('result', i === sel && 'selected')}
              onMouseEnter={() => setSel(i)}
              onClick={() => choose(it)}
            >
              {it.kind === 'action' ? (
                <>
                  <Icon name="bolt" />
                  <span className="label">{it.a.label}</span>
                  <span className="hint">{t('act.action')}</span>
                </>
              ) : it.kind === 'suggest' ? (
                <>
                  <Icon name={it.s.kind === 'bookmark' ? 'star' : 'clock'} />
                  <span className="label">
                    {it.s.title}
                    <span className="sub">{displayUrl(it.s.url)}</span>
                  </span>
                  <span className="hint">
                    {it.s.kind === 'bookmark' ? t('bar.bookmark') : t('bar.history')}
                    {it.s.source ? ` · ${it.s.source}` : ''}
                  </span>
                </>
              ) : it.kind === 'go' ? (
                <>
                  <Icon name={looksLikeUrl(it.input) ? 'globe' : 'search'} />
                  <span className="label">{it.input}</span>
                  <span className="hint">{looksLikeUrl(it.input) ? t('bar.open') : t('bar.searchWith', { engine: SEARCH_ENGINES[state.settings.searchEngine].name })}{navigateCurrent ? '' : t('bar.inNewTab')}</span>
                </>
              ) : (
                <>
                  <Favicon tab={it.tab} />
                  <span className="label">
                    {it.tab.title}
                    <span className="sub">{displayUrl(it.tab.url)}</span>
                  </span>
                  <span className="hint">
                    {it.tab.essential ? t('bar.essential') : spaceName(it.tab.spaceId)} · {t('bar.switch')}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
