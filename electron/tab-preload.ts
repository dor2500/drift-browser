/// <reference lib="dom" />
// Runs in every web page (isolated world, sandboxed). Its only job: turn
// Alt+click on a link into a Glance request instead of a download.
import { ipcRenderer } from 'electron';

window.addEventListener(
  'click',
  (e) => {
    if (!e.isTrusted || !e.altKey || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const link = e.composedPath().find((n): n is HTMLAnchorElement => n instanceof HTMLAnchorElement && !!n.href);
    if (!link || !/^https?:/i.test(link.href)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    ipcRenderer.send('drift:glance', { url: link.href, x: e.clientX, y: e.clientY });
  },
  true,
);
