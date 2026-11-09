import { type DragEvent } from 'react';
import {
  aiActions,
  browserStore,
  clipboardActions,
  cmd,
  darkModeActions,
  handoffActions,
  syncActions,
  useAiState,
  useBrowserState,
  useClipboardState,
  useDarkModeState,
  useSyncState,
} from './state/BrowserStore';

export const drift = () => window.drift;
export {
  aiActions,
  browserStore,
  clipboardActions,
  cmd,
  darkModeActions,
  handoffActions,
  syncActions,
  useAiState,
  useBrowserState,
  useClipboardState,
  useDarkModeState,
  useSyncState,
};

/** Title to show for a tab; internal pages (drift://settings) follow the UI language. */
export const tabTitle = (tab: { url: string; title: string }, settingsTitle: string, newTabTitle = 'New Tab') =>
  tab.url.startsWith('drift://settings')
    ? settingsTitle
    : tab.url.startsWith('drift://store')
      ? 'חנות תוספים וערכות · Drift Store'
      : tab.url.startsWith('drift://newtab')
        ? newTabTitle
        : tab.title || tab.url;

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

// Tab drag & drop (HTML5 DnD inside the sidebar).
export const TAB_MIME = 'application/x-drift-tab';
export const isTabDrag = (e: DragEvent) => e.dataTransfer.types.includes(TAB_MIME);
export function startTabDrag(e: DragEvent, id: string) {
  e.dataTransfer.setData(TAB_MIME, id);
  e.dataTransfer.effectAllowed = 'move';
  document.body.classList.add('dragging');
}
export const endTabDrag = () => document.body.classList.remove('dragging');
