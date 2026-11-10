import { useEffect, useMemo, useRef, useState } from 'react';
import type { BrowserState, Suggestion, TabState } from '../../shared/types';
import { COLOR_THEMES } from '../../shared/colorThemes';
import { translate } from '../../shared/i18n';
import { SEARCH_ENGINES } from '../../shared/settings';
import { displayUrl, looksLikeUrl } from '../../shared/url';
import { aiActions, cmd, cx, darkModeActions } from '../lib';
import { Favicon } from './Favicon';
import { Icon } from './Icon';
import { openShellPopover } from './PageActions';
import type { Anchor } from './TopBar';
import { t } from '../i18n';
import { evaluateOmniboxQuery, type OmniboxAnswer } from '../lib/omniboxCalculator';

type Action = { id: string; label: string; en: string; run: () => void };
type RemoteTabHit = { deviceName: string; url: string; title: string };
type Item =
  | { kind: 'calc'; answer: OmniboxAnswer }
  | { kind: 'go'; input: string }
  | { kind: 'ai'; prompt: string }
  | { kind: 'action'; a: Action }
  | { kind: 'suggest'; s: Suggestion }
  | { kind: 'tab'; tab: TabState }
  | { kind: 'remote-tab'; r: RemoteTabHit };

interface Props {
  mode: 'new' | 'current';
  state: BrowserState;
  /** Drop down from this omnibox rectangle instead of floating mid-screen. */
  anchor?: Anchor;
  onClose: () => void;
}

/** Zen's floating URL bar: type a URL, search, ask @ai (Ollama), or jump to a local/remote tab. */
export function CommandBar({ mode, state, anchor, onClose }: Props) {
  const active = state.tabs.find((t) => t.id === (state.glance?.id ?? state.activeTabId));
  const navigateCurrent = mode === 'current' && !!active;
  const [q, setQ] = useState(navigateCurrent ? active!.url : '');
  const [sel, setSel] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Bookmarks and history (Drift's own plus imported) matching what you type.
  useEffect(() => {
    const s = q.trim();
    if (!s || s.startsWith('@ai') || s.startsWith('?') || (navigateCurrent && s === active?.url)) {
      setSuggestions([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => void window.drift.suggest(s).then((r) => alive && setSuggestions(r)), 60);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, navigateCurrent, active?.url]);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  // Things you can do by typing their name, like Arc's and Vivaldi's command bars.
  const actions = useMemo<Action[]>(() => {
    const id = active?.id;
    const host = active && /^https?:/.test(active.url) ? new URL(active.url).hostname.replace(/^www\./, '').toLowerCase() : '';
    const list: Action[] = [
      { id: 'shortcuts', label: 'קיצורי מקלדת ופקודות · Keyboard Shortcuts (Ctrl+/)', en: 'open keyboard shortcuts hotkeys cheat sheet', run: () => cmd({ type: 'shortcuts:open' }) },
      { id: 'performance', label: 'מרכז ביצועים וזיכרון · Performance & Memory Saver', en: 'open performance dashboard memory saver task', run: () => cmd({ type: 'performance:open' }) },
      { id: 'store', label: 'פתח את חנות התוספים והערכות · Open Drift Store (Ctrl+Shift+E)', en: 'open drift store extensions add-ons themes', run: () => cmd({ type: 'store:open' }) },
      { id: 'ai-panel', label: `${t('ai.title')} (Ctrl+Shift+A)`, en: 'local ai assistant ollama panel', run: () => aiActions.togglePanel() },
      { id: 'ai-sum', label: `${t('ai.summarize')} (Ollama)`, en: 'summarize page with local ai ollama', run: () => aiActions.summarizeCurrentPage() },
      { id: 'ai-exp', label: `${t('ai.explain')} (Ollama)`, en: 'explain page key points with local ai ollama', run: () => aiActions.explainCurrentPage() },
      { id: 'ai-tr', label: `${t('ai.translate')} (Ollama)`, en: 'translate page with local ai ollama', run: () => aiActions.translateCurrentPage() },
      { id: 'darkmode', label: t('dm.title'), en: 'dark mode engine theme customize', run: () => setTimeout(() => openShellPopover('darkmode'), 40) },
      {
        id: 'darkmode-global',
        label: state.settings.darkMode.enabled ? 'Disable Global Dark Mode Engine' : 'Enable Global Dark Mode Engine',
        en: 'toggle global force dark mode engine',
        run: () => darkModeActions.update({ enabled: !state.settings.darkMode.enabled }),
      },
      ...(host
        ? [
            {
              id: 'darkmode-site',
              label: t('dm.toggleSite', { host }),
              en: `toggle dark mode for ${host}`,
              run: () => darkModeActions.toggleForHost(host),
            },
          ]
        : []),
      { id: 'clipboard', label: t('clip.title'), en: 'universal cloud clipboard snippets', run: () => setTimeout(() => openShellPopover('clipboard'), 40) },
      { id: 'handoff', label: 'Send Tab to Another Device / Handoff', en: 'send tab to device handoff synced tabs', run: () => setTimeout(() => openShellPopover('handoff'), 40) },
      { id: 'find', label: t('act.find'), en: translate({}, 'act.find'), run: () => setTimeout(() => window.dispatchEvent(new CustomEvent('drift:find')), 50) },
      { id: 'downloads', label: t('act.downloads'), en: translate({}, 'act.downloads'), run: () => window.drift.downloadsMenu() },
      { id: 'zoomin', label: t('act.zoomIn'), en: translate({}, 'act.zoomIn'), run: () => cmd({ type: 'zoom', dir: 1 }) },
      { id: 'zoomout', label: t('act.zoomOut'), en: translate({}, 'act.zoomOut'), run: () => cmd({ type: 'zoom', dir: -1 }) },
      { id: 'zoomreset', label: t('act.zoomReset'), en: translate({}, 'act.zoomReset'), run: () => cmd({ type: 'zoom', dir: 0 }) },
      { id: 'print', label: t('act.print'), en: translate({}, 'act.print'), run: () => cmd({ type: 'page:print' }) },
      { id: 'shot', label: t('act.screenshot'), en: translate({}, 'act.screenshot'), run: () => cmd({ type: 'page:screenshot' }) },
      { id: 'translate', label: t('act.translate'), en: translate({}, 'act.translate'), run: () => cmd({ type: 'page:translate' }) },
      { id: 'source', label: t('act.source'), en: translate({}, 'act.source'), run: () => cmd({ type: 'page:source' }) },
      { id: 'reading-mode', label: 'מצב קריאה מתקדם (Reader Mode Pro · F9 / Ctrl+Alt+R)', en: 'reader mode clean text reading tts voice aloud print save markdown distraction free', run: () => cmd({ type: 'page:readingMode' }) },
      { id: 'pip', label: t('act.pip'), en: translate({}, 'act.pip'), run: () => cmd({ type: 'page:pip' }) },
      { id: 'media-hub', label: 'בקרת מדיה וסאונד גלובלית (Global Media Controls & 300% Booster · Ctrl+Alt+M)', en: 'media controls volume boost 300 pip picture in picture audio music speed', run: () => setTimeout(() => openShellPopover('media'), 40) },
      { id: 'sidepanel', label: 'חלונית הצד של כרום: רשימת קריאה, סימניות ופתקים (Chrome Side Panel · Ctrl+Shift+P)', en: 'chrome side panel reading list bookmarks side search notes', run: () => setTimeout(() => openShellPopover('sidepanel'), 40) },
      { id: 'split', label: t('act.split'), en: translate({}, 'act.split'), run: () => cmd({ type: 'split:toggle' }) },
      { id: 'compact', label: t('act.compact'), en: translate({}, 'act.compact'), run: () => cmd({ type: 'ui:compact' }) },
      { id: 'vertical', label: t('act.vertical'), en: translate({}, 'act.vertical'), run: () => cmd({ type: 'settings:set', patch: { verticalTabs: !state.settings.verticalTabs } }) },
      { id: 'reopen', label: t('menu.reopen'), en: translate({}, 'menu.reopen'), run: () => cmd({ type: 'tab:reopen' }) },
      { id: 'newspace', label: t('menu.newSpace'), en: translate({}, 'menu.newSpace'), run: () => cmd({ type: 'space:new' }) },
      { id: 'settings', label: t('menu.settings'), en: translate({}, 'menu.settings'), run: () => cmd({ type: 'settings:open' }) },
      { id: 'history', label: 'היסטוריית גלישה (Browsing History · Ctrl+H)', en: 'browsing history recent visits clear cache cookies delete', run: () => cmd({ type: 'history:open' }) },
      { id: 'clear-browsing-data', label: 'מחיקת נתוני גלישה ומטמון (Clear Browsing Data · Ctrl+Shift+Delete)', en: 'clear browsing data history cache cookies delete wipe remove', run: () => cmd({ type: 'tab:new', url: 'drift://history?clear=true' }) },
      { id: 'downloads-page', label: 'מנהל ההורדות (Downloads Hub · Ctrl+J)', en: 'downloads manager files torrent progress list open folder', run: () => cmd({ type: 'downloads:open' }) },
      { id: 'passwords', label: 'מנהל הסיסמאות והאימות (Password Manager)', en: 'password manager credentials autofill generate encrypt', run: () => cmd({ type: 'passwords:open' }) },
      { id: 'autofill', label: 'מילוי אוטומטי, כרטיסי אשראי וכתובות (Autofill & Payment Cards)', en: 'autofill payments credit cards addresses checkout', run: () => cmd({ type: 'autofill:open' }) },
      { id: 'cookies', label: 'נתוני אתרים וקובצי עוגיות (Site Data & Cookies Explorer)', en: 'cookies site data localstorage inspect domain delete clear export', run: () => cmd({ type: 'cookies:open' }) },
      { id: 'bookmarks', label: 'מנהל הסימניות (Bookmarks Manager · Ctrl+Shift+O)', en: 'bookmarks manager favorites links html export', run: () => cmd({ type: 'bookmarks:open' }) },
      { id: 'sessions', label: 'סשנים שמורים ושמירת כרטיסיות (Tab Stash · Ctrl+Shift+S)', en: 'sessions tab stash snapshots restore tabs save session', run: () => cmd({ type: 'sessions:open' }) },
      { id: 'performance', label: 'לוח ביצועים וחיסכון בזיכרון (Memory Saver & Performance)', en: 'performance memory saver dashboard tabs ram sleep wake', run: () => cmd({ type: 'performance:open' }) },
      { id: 'task-manager', label: 'מנהל משימות של הדפדפן (Task Manager · Shift+Esc)', en: 'task manager processes cpu memory ram kill end process tabs', run: () => cmd({ type: 'taskManager:open' }) },
      { id: 'shortcuts', label: 'לוח קיצורי מקלדת (Keyboard Shortcuts Hub · Ctrl+/)', en: 'keyboard shortcuts hotkeys command quick', run: () => cmd({ type: 'shortcuts:open' }) },
      { id: 'store', label: 'חנות התוספים וההרחבות (Drift Store · Ctrl+Shift+E)', en: 'drift store extensions addons themes plugins', run: () => cmd({ type: 'store:open' }) },
      { id: 'extensions-manager', label: 'ניהול תוספים והרחבות כרום (Chrome Extensions Manager · chrome://extensions)', en: 'extensions manager unpacked load developer mode chrome addons plugins', run: () => cmd({ type: 'extensions:open' }) },
      { id: 'site-settings', label: 'הגדרות אתרים והרשאות תוכן (Chrome Content Settings · chrome://settings/content)', en: 'site settings permissions camera microphone location notifications popups content cookies allow block', run: () => cmd({ type: 'tab:new', url: 'drift://site-settings' }) },
      {
        id: 'vpn-toggle',
        label: state.settings.vpn.enabled ? 'השבת חיבור VPN ופרוקסי (Drift VPN)' : 'הפעל חיבור VPN ופרוקסי מאובטח (Drift VPN)',
        en: 'toggle vpn secure proxy private tunnel socks5',
        run: () => cmd({ type: 'settings:set', patch: { vpn: { enabled: !state.settings.vpn.enabled } } }),
      },
      {
        id: 'vpn-page',
        label: 'מרכז VPN וחיבור פרטי (Drift VPN & Private Proxy Hub · drift://vpn)',
        en: 'open vpn proxy private custom server socks5 wireguard leak protect bypass',
        run: () => cmd({ type: 'vpn:open' }),
      },
      { id: 'incognito', label: 'חלון גלישה בסתר חדש (New Incognito Window · Ctrl+Shift+N)', en: 'incognito private window secret anonymous', run: () => cmd({ type: 'win:incognito' }) },
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
  }, [active, state.settings.verticalTabs, state.settings.darkMode.enabled]);

  const items = useMemo<Item[]>(() => {
    const raw = q.trim();
    // Omnibox Local AI shortcut: `@ai <prompt>` or `? <prompt>`
    if (/^(@ai\b|\?)/i.test(raw)) {
      const promptText = raw.replace(/^(@ai\b|\?)\s*/i, '').trim();
      return [
        {
          kind: 'ai',
          prompt: promptText || 'Summarize this webpage',
        },
        ...actions.slice(0, 4).map((a) => ({ kind: 'action' as const, a })),
      ];
    }

    const actionMode = raw.startsWith('>');
    const s = actionMode ? raw.slice(1).trim() : raw;
    const needle = s.toLowerCase();
    const matching = actions.filter((a) => needle && (a.label.toLowerCase().includes(needle) || a.en.toLowerCase().includes(needle)));
    if (actionMode) return (needle ? matching : actions).slice(0, 12).map((a) => ({ kind: 'action' as const, a }));

    const out: Item[] = [];

    // Omnibox Smart Calculator, Unit Converter & Direct Answers
    const calcAnswer = evaluateOmniboxQuery(s);
    if (calcAnswer) {
      out.push({ kind: 'calc', answer: calcAnswer });
    }

    if (s) out.push({ kind: 'go', input: s });
    if (needle.length >= 2) for (const a of matching.slice(0, 3)) out.push({ kind: 'action', a });
    const open = new Set(state.tabs.map((t) => t.url));
    for (const sg of suggestions) if (!open.has(sg.url)) out.push({ kind: 'suggest', s: sg });
    const tabs = state.tabs
      .filter((t) => t.id !== state.activeTabId && !t.glanceOf)
      .filter((t) => !needle || t.title.toLowerCase().includes(needle) || t.url.toLowerCase().includes(needle))
      .slice(0, 5);
    for (const tab of tabs) out.push({ kind: 'tab', tab });

    // Also include matching open tabs from other synced devices
    if (needle.length >= 2) {
      for (const dev of state.sync.otherDevices) {
        for (const rt of dev.tabs) {
          if (rt.title.toLowerCase().includes(needle) || rt.url.toLowerCase().includes(needle)) {
            out.push({ kind: 'remote-tab', r: { deviceName: dev.name, url: rt.url, title: rt.title } });
          }
        }
      }
    }
    return out;
  }, [q, state.tabs, state.activeTabId, state.sync.otherDevices, suggestions, actions]);

  useEffect(() => setSel(0), [q]);

  const choose = (it: Item | undefined) => {
    if (!it) return;
    if (it.kind === 'calc') {
      navigator.clipboard.writeText(it.answer.result);
      setToast(`הועתק: ${it.answer.result}`);
      setTimeout(() => onClose(), 650);
      return;
    } else if (it.kind === 'ai') {
      aiActions.sendPrompt(it.prompt, 'chat', true);
    } else if (it.kind === 'action') {
      it.a.run();
    } else if (it.kind === 'tab') {
      cmd({ type: 'tab:activate', id: it.tab.id });
    } else if (it.kind === 'remote-tab') {
      cmd({ type: 'tab:new', url: it.r.url });
    } else {
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
          <Icon name={/^(@ai\b|\?)/i.test(q.trim()) ? 'sparkles' : 'search'} size={18} />
          <input
            ref={input}
            value={q}
            spellCheck={false}
            placeholder={
              navigateCurrent
                ? `${t('url.placeholder')} (or type @ai to ask Ollama)`
                : `${t('bar.placeholderNew')} (or @ai to ask Ollama)`
            }
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
              key={
                it.kind === 'calc'
                  ? `calc:${it.answer.title}`
                  : it.kind === 'go'
                    ? 'go'
                    : it.kind === 'ai'
                      ? 'ai'
                      : it.kind === 'action'
                        ? `a:${it.a.id}`
                        : it.kind === 'suggest'
                          ? `s:${it.s.url}`
                          : it.kind === 'remote-tab'
                            ? `rt:${it.r.deviceName}:${it.r.url}`
                            : it.tab.id
              }
              className={cx('result', i === sel && 'selected', it.kind === 'calc' && 'calc-result')}
              onMouseEnter={() => setSel(i)}
              onClick={() => choose(it)}
            >
              {it.kind === 'calc' ? (
                <>
                  <div className="calc-badge-icon" data-cat={it.answer.category}>
                    <Icon name={it.answer.icon === 'palette' ? 'palette' : it.answer.icon === 'ruler' ? 'sliders' : it.answer.icon === 'coins' ? 'cart' : 'bolt'} size={15} />
                  </div>
                  <span className="label">
                    <span className="calc-result-text">{it.answer.title}</span>
                    <span className="sub">{it.answer.subtitle}</span>
                  </span>
                  <span className="hint calc-hint">
                    {it.answer.category === 'math' ? '🧮 חישוב' : it.answer.category === 'currency' ? '💱 מטבע' : it.answer.category === 'unit' ? '📏 יחידות' : '🎨 צבע'} · העתק ↵
                  </span>
                </>
              ) : it.kind === 'ai' ? (
                <>
                  <Icon name="sparkles" />
                  <span className="label">
                    Ask Local AI (Ollama): <strong>{it.prompt}</strong>
                  </span>
                  <span className="hint">Local AI · {state.settings.ai.model}</span>
                </>
              ) : it.kind === 'action' ? (
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
              ) : it.kind === 'remote-tab' ? (
                <>
                  <Icon name="devices" />
                  <span className="label">
                    {it.r.title}
                    <span className="sub">{displayUrl(it.r.url)}</span>
                  </span>
                  <span className="hint">{it.r.deviceName} · Synced Tab</span>
                </>
              ) : it.kind === 'go' ? (
                <>
                  <Icon name={looksLikeUrl(it.input) ? 'globe' : 'search'} />
                  <span className="label">{it.input}</span>
                  <span className="hint">
                    {looksLikeUrl(it.input)
                      ? t('bar.open')
                      : t('bar.searchWith', { engine: SEARCH_ENGINES[state.settings.searchEngine].name })}
                    {navigateCurrent ? '' : t('bar.inNewTab')}
                  </span>
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
        {toast && (
          <div className="commandbar-toast">
            <Icon name="check" size={13} />
            <span>{toast}</span>
          </div>
        )}
      </div>
    </div>
  );
}
