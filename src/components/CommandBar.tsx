import { useEffect, useMemo, useRef, useState } from 'react';
import type { BrowserState, TabState } from '../../shared/types';
import { SEARCH_ENGINES } from '../../shared/settings';
import { displayUrl, looksLikeUrl } from '../../shared/url';
import { cmd, cx } from '../lib';
import { Favicon } from './Favicon';
import { Icon } from './Icon';
import type { Anchor } from './TopBar';

type Item = { kind: 'go'; input: string } | { kind: 'tab'; tab: TabState };

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
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const items = useMemo<Item[]>(() => {
    const s = q.trim();
    const needle = s.toLowerCase();
    const out: Item[] = s ? [{ kind: 'go', input: s }] : [];
    const tabs = state.tabs
      .filter((t) => t.id !== state.activeTabId && !t.glanceOf)
      .filter((t) => !needle || t.title.toLowerCase().includes(needle) || t.url.toLowerCase().includes(needle))
      .slice(0, 7);
    for (const tab of tabs) out.push({ kind: 'tab', tab });
    return out;
  }, [q, state.tabs, state.activeTabId]);

  useEffect(() => setSel(0), [q]);

  const choose = (it: Item | undefined) => {
    if (!it) return;
    if (it.kind === 'tab') cmd({ type: 'tab:activate', id: it.tab.id });
    else if (navigateCurrent) cmd({ type: 'tab:navigate', input: it.input });
    else cmd({ type: 'tab:new', url: it.input });
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
            placeholder={navigateCurrent ? 'Search or enter address' : 'Open a new tab: search or enter address'}
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
              key={it.kind === 'go' ? 'go' : it.tab.id}
              className={cx('result', i === sel && 'selected')}
              onMouseEnter={() => setSel(i)}
              onClick={() => choose(it)}
            >
              {it.kind === 'go' ? (
                <>
                  <Icon name={looksLikeUrl(it.input) ? 'globe' : 'search'} />
                  <span className="label">{it.input}</span>
                  <span className="hint">{looksLikeUrl(it.input) ? 'Open' : `Search with ${SEARCH_ENGINES[state.settings.searchEngine].name}`}{navigateCurrent ? '' : ' in new tab'}</span>
                </>
              ) : (
                <>
                  <Favicon tab={it.tab} />
                  <span className="label">
                    {it.tab.title}
                    <span className="sub">{displayUrl(it.tab.url)}</span>
                  </span>
                  <span className="hint">
                    {it.tab.essential ? 'Essential' : spaceName(it.tab.spaceId)} · Switch to tab
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
