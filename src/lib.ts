import { useEffect, useState, type DragEvent } from 'react';
import type { BrowserState, Command } from '../shared/types';

export const drift = () => window.drift;
export const cmd = (c: Command) => void window.drift.cmd(c);

/** Title to show for a tab; internal pages (drift://settings) follow the UI language. */
export const tabTitle = (tab: { url: string; title: string }, settingsTitle: string) =>
  tab.url.startsWith('drift://settings') ? settingsTitle : tab.title || tab.url;

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** Mirrors the main process's browser model. */
export function useBrowserState() {
  const [state, setState] = useState<BrowserState | null>(null);
  useEffect(() => {
    void window.drift.getState().then(setState);
    return window.drift.onState(setState);
  }, []);
  return state;
}

// Tab drag & drop (HTML5 DnD inside the sidebar).
export const TAB_MIME = 'application/x-drift-tab';
export const isTabDrag = (e: DragEvent) => e.dataTransfer.types.includes(TAB_MIME);
export function startTabDrag(e: DragEvent, id: string) {
  e.dataTransfer.setData(TAB_MIME, id);
  e.dataTransfer.effectAllowed = 'move';
  document.body.classList.add('dragging');
}
export const endTabDrag = () => document.body.classList.remove('dragging');
