import type { LocalStore } from '../data/store';
import { createLlmClient, type ChatMessage } from '../llm';
import { buildUntrustedPrompt } from '../llm/untrusted';
import { randomHex } from '../lib/random';
import type { Settings } from '../settings/settings';
import { byId, errorMessage, setText } from './dom';

/** What gets stored: the full content sent to the model plus what the bubble shows. */
interface StoredMessage extends ChatMessage {
  text: string;
  attached: boolean;
}

export interface ChatController {
  abort(): void;
}

/** Message content element. dir="auto" lets each message take its direction from its own text, not the UI language. */
export function messageBody(text: string): HTMLDivElement {
  const body = document.createElement('div');
  body.className = 'body';
  body.dir = 'auto';
  // textContent only: model output is untrusted and must never be parsed as HTML.
  body.textContent = text;
  return body;
}

function isStoredMessage(value: unknown): value is StoredMessage {
  const m = value as Partial<StoredMessage> | null;
  return !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && typeof m.text === 'string';
}

export function mountChat(store: LocalStore, getSettings: () => Settings): ChatController {
  const list = byId<HTMLOListElement>('messages');
  const empty = byId('empty');
  const form = byId<HTMLFormElement>('composer');
  const prompt = byId<HTMLTextAreaElement>('prompt');
  const doc = byId<HTMLTextAreaElement>('doc');
  const docBox = byId<HTMLDetailsElement>('doc-box');
  const send = byId<HTMLButtonElement>('send');
  const stop = byId<HTMLButtonElement>('stop');
  const clear = byId<HTMLButtonElement>('clear');
  const error = byId('error');
  const history: StoredMessage[] = [];
  let controller: AbortController | null = null;
  let lastCreatedAt = 0;

  function render(message: StoredMessage): HTMLElement {
    const item = document.createElement('li');
    item.className = `msg ${message.role}`;
    const who = document.createElement('span');
    who.className = 'who';
    setText(who, message.role === 'user' ? 'chat.you' : 'chat.assistant');
    const body = messageBody(message.text);
    item.append(who, body);
    if (message.attached) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      setText(tag, 'doc.attached');
      item.append(tag);
    }
    list.append(item);
    empty.hidden = true;
    item.scrollIntoView({ block: 'end' });
    return body;
  }

  function remember(message: StoredMessage): void {
    history.push(message);
    lastCreatedAt = Math.max(Date.now(), lastCreatedAt + 1);
    store.put({ id: randomHex(), kind: 'message', createdAt: lastCreatedAt, data: message }).catch(() => undefined);
  }

  function setBusy(busy: boolean): void {
    send.hidden = busy;
    stop.hidden = !busy;
  }

  async function submit(): Promise<void> {
    const text = prompt.value.trim();
    if (!text || controller) return;
    const settings = getSettings();
    const attachment = doc.value.trim();
    const user: StoredMessage = {
      role: 'user',
      content: attachment ? buildUntrustedPrompt(text, [{ text: attachment, label: 'pasted document' }]) : text,
      text,
      attached: Boolean(attachment),
    };
    error.hidden = true;
    prompt.value = '';
    doc.value = '';
    docBox.open = false;
    remember(user);
    render(user);

    const output = render({ role: 'assistant', content: '', text: '', attached: false });
    output.parentElement?.classList.add('streaming');
    controller = new AbortController();
    setBusy(true);
    let partial = '';
    try {
      const client = createLlmClient({ baseUrl: settings.baseUrl, model: settings.model, apiKey: settings.apiKey });
      const result = await client.chat({
        messages: history.map(({ role, content }) => ({ role, content })),
        systemPrompt: settings.systemPrompt,
        signal: controller.signal,
        onToken: (_delta, soFar) => {
          partial = soFar;
          output.textContent = soFar;
        },
      });
      output.textContent = result.content;
      remember({ role: 'assistant', content: result.content, text: result.content, attached: false });
    } catch (err) {
      error.textContent = errorMessage(err);
      error.hidden = false;
      if (partial) remember({ role: 'assistant', content: partial, text: partial, attached: false });
      else output.parentElement?.remove();
    } finally {
      output.parentElement?.classList.remove('streaming');
      controller = null;
      setBusy(false);
      empty.hidden = list.childElementCount > 0;
      prompt.focus();
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit();
  });
  prompt.addEventListener('keydown', (event) => {
    // Enter sends, Shift+Enter adds a line. isComposing keeps IME input (Persian, Arabic, CJK) working.
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void submit();
    }
  });
  stop.addEventListener('click', () => controller?.abort());
  clear.addEventListener('click', () => {
    controller?.abort();
    history.length = 0;
    list.replaceChildren();
    empty.hidden = false;
    error.hidden = true;
    store.clear().catch(() => undefined);
  });

  store
    .list('message')
    .then((records) => {
      for (const record of records) {
        if (!isStoredMessage(record.data)) continue;
        history.push(record.data);
        lastCreatedAt = Math.max(lastCreatedAt, record.createdAt);
        render(record.data);
      }
    })
    .catch(() => undefined);

  return { abort: () => controller?.abort() };
}
