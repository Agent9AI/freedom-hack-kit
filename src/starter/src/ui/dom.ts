import { LlmError, type LlmErrorKind } from '../llm/types';
import { t, type MessageKey } from '../i18n';

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el as T;
}

/** Sets translated text and remembers the key so a language switch retranslates it. */
export function setText(el: HTMLElement, key: MessageKey, vars?: Record<string, string | number>): void {
  if (vars) delete el.dataset.i18n;
  else el.dataset.i18n = key;
  el.textContent = t(key, vars);
}

const ERROR_KEYS: Record<LlmErrorKind, MessageKey> = {
  config: 'err.config',
  offline: 'err.offline',
  unreachable: 'err.unreachable',
  timeout: 'err.timeout',
  http: 'err.http',
  aborted: 'err.aborted',
  'bad-response': 'err.badResponse',
};

/** Human message for any error, with server detail on its own line. Render with textContent only. */
export function errorMessage(err: unknown): string {
  const error = err instanceof LlmError ? err : new LlmError('bad-response', String(err));
  const message = t(ERROR_KEYS[error.kind], { status: error.status ?? '' });
  return error.detail ? `${message}\n${error.detail}` : message;
}
