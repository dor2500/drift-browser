import { net, type WebContents } from 'electron';
import type { StateManager } from './state-manager';

export interface PageContextData {
  url: string;
  title: string;
  selection: string;
  content: string;
}

/**
 * Local AI Assistant (`OllamaService`).
 *
 * Connects exclusively to the user's local Ollama instance (e.g. http://localhost:11434)
 * to summarize the current webpage, translate text, explain concepts, or answer questions
 * without sending any browsing data to external cloud AI servers.
 */
export class OllamaService {
  private abortController?: AbortController;

  constructor(
    private state: StateManager,
    private getActiveWebContents: () => WebContents | undefined,
  ) {}

  private get endpoint(): string {
    return (this.state.settings.ai.endpoint || 'http://localhost:11434').replace(/\/+$/, '');
  }

  /** Queries local Ollama instance for installed models (`GET /api/tags`). */
  async refreshModels(): Promise<string[]> {
    try {
      const res = await net.fetch(`${this.endpoint}/api/tags`, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { models?: { name: string }[] };
      const models = (data.models ?? []).map((m) => m.name).filter(Boolean);
      this.state.setAiModels(models, true);
      return models;
    } catch {
      this.state.setAiModels([], false);
      return [];
    }
  }

  /** Extracts clean readable text and user selection from the active tab's WebContents. */
  async extractPageContext(): Promise<PageContextData | undefined> {
    const wc = this.getActiveWebContents();
    if (!wc || wc.isDestroyed()) return undefined;
    const url = wc.getURL();
    if (!/^https?:/i.test(url)) return undefined;

    try {
      const extracted = (await wc.executeJavaScript(
        `(() => {
          const selection = (window.getSelection()?.toString() || '').trim();
          const clone = (document.querySelector('article, main, [role="main"]') || document.body)?.cloneNode(true);
          if (clone && clone.querySelectorAll) {
            clone.querySelectorAll('script, style, noscript, nav, footer, iframe, svg').forEach(el => el.remove());
          }
          const rawText = (clone?.innerText || document.body?.innerText || '').replace(/\\s+/g, ' ').trim();
          return {
            title: document.title || '',
            selection: selection.slice(0, 6000),
            content: rawText.slice(0, 14000),
          };
        })()`,
        true,
      )) as { title: string; selection: string; content: string };

      return {
        url,
        title: extracted.title || wc.getTitle() || url,
        selection: extracted.selection,
        content: extracted.content,
      };
    } catch {
      return { url, title: wc.getTitle() || url, selection: '', content: '' };
    }
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }
    if (this.state.ai.status === 'streaming' || this.state.ai.status === 'connecting') {
      this.state.setAiStatus('idle');
    }
  }

  /** Run a prompt or built-in action ('summarize' | 'translate' | 'explain' | 'chat') against local Ollama. */
  async runPrompt(opts: {
    prompt: string;
    action?: 'chat' | 'summarize' | 'translate' | 'explain';
    includePage?: boolean;
  }): Promise<void> {
    this.stop();

    if (!this.state.ai.open) {
      this.state.setAiOpen(true);
    }

    this.state.setAiStatus('connecting');
    let models = this.state.ai.availableModels;
    if (!models.length || !this.state.ai.ollamaOnline) {
      models = await this.refreshModels();
    }

    const model = this.state.settings.ai.model || this.state.ai.selectedModel || models[0] || 'llama3.2';
    const action = opts.action ?? 'chat';
    const usePage = opts.includePage ?? (action !== 'chat' || this.state.settings.ai.includePageContext);
    const page = usePage ? await this.extractPageContext() : undefined;

    let displayUserText = opts.prompt.trim();
    let fullPrompt = opts.prompt.trim();

    if (action === 'summarize') {
      displayUserText = displayUserText || `Summarize this page: ${page?.title ?? 'current tab'}`;
      fullPrompt =
        `Summarize the following webpage clearly and concisely with key bullet points and a brief executive takeaway.\n\n` +
        `Title: ${page?.title ?? 'Unknown'}\nURL: ${page?.url ?? ''}\n` +
        (page?.selection ? `Selected Text:\n${page.selection}\n\n` : '') +
        `Page Content:\n${page?.content || '(No readable text found on page)'}`;
    } else if (action === 'translate') {
      const targetLang = opts.prompt.trim() || this.state.settings.ai.targetLanguage || 'English';
      displayUserText = `Translate to ${targetLang}`;
      const sourceText = page?.selection || page?.content || '';
      fullPrompt =
        `Translate the following text accurately into ${targetLang}. Preserve formatting and tone:\n\n` +
        (sourceText || '(No text selected or found on page)');
    } else if (action === 'explain') {
      displayUserText = displayUserText || `Explain key concepts on: ${page?.title ?? 'current tab'}`;
      fullPrompt =
        `Explain the main concepts, arguments, and technical details of the following content in simple, structured terms:\n\n` +
        `Title: ${page?.title ?? 'Unknown'}\n` +
        (page?.selection ? `Selected Text:\n${page.selection}\n\n` : `Page Content:\n${page?.content || ''}`);
    } else if (page && (page.selection || page.content)) {
      fullPrompt =
        `Context from current browser tab ("${page.title}" - ${page.url}):\n` +
        (page.selection ? `[Selected Text]: ${page.selection}\n` : '') +
        `[Webpage Content]: ${page.content.slice(0, 10000)}\n\n` +
        `User Question: ${opts.prompt}`;
    }

    this.state.appendAiMessage({ role: 'user', content: displayUserText, action });
    const assistantMsg = this.state.appendAiMessage({ role: 'assistant', content: '', action });

    const controller = new AbortController();
    this.abortController = controller;
    this.state.setAiStatus('streaming');

    try {
      const historyMessages = this.state.ai.messages
        .slice(0, -2)
        .filter((m) => m.content.trim().length > 0)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await net.fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [
            { role: 'system', content: this.state.settings.ai.systemPrompt },
            ...historyMessages,
            { role: 'user', content: fullPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(errBody || `Ollama returned HTTP ${res.status} (model: ${model})`);
      }

      if (!res.body) {
        const json = (await res.json()) as { message?: { content?: string } };
        this.state.updateAiMessageContent(assistantMsg.id, json.message?.content ?? '');
        this.state.setAiStatus('idle');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as { message?: { content?: string }; response?: string; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            const token = parsed.message?.content ?? parsed.response ?? '';
            if (token) {
              accumulated += token;
              this.state.updateAiMessageContent(assistantMsg.id, accumulated);
            }
          } catch (e) {
            if (e instanceof Error && !e.message.includes('JSON')) throw e;
          }
        }
      }

      this.state.setAiStatus('idle');
    } catch (err) {
      if (controller.signal.aborted) {
        this.state.setAiStatus('idle');
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      const friendly =
        message.includes('ECONNREFUSED') || message.includes('fetch failed')
          ? `Could not connect to local Ollama at ${this.endpoint}. Make sure Ollama is running ("ollama serve") and a model is pulled (e.g. "ollama pull llama3.2").`
          : message;
      this.state.updateAiMessageContent(assistantMsg.id, `⚠️ ${friendly}`);
      this.state.setAiStatus('error', friendly);
    } finally {
      if (this.abortController === controller) {
        this.abortController = undefined;
      }
    }
  }
}

