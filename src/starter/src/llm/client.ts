import { DEFAULT_IDLE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, isLoopbackUrl } from './providers';
import { readSseData } from './sse';
import { LlmError, type ChatMessage, type ChatRequest, type ChatResult, type FetchLike, type LlmClientDeps, type LlmConfig } from './types';

export interface LlmClient {
  /** POST {baseUrl}/chat/completions. Streams by default and resolves with the full text. */
  chat(request: ChatRequest): Promise<ChatResult>;
  /** GET {baseUrl}/models. Used by the "Fetch models" button. */
  listModels(signal?: AbortSignal): Promise<string[]>;
}

interface CompletionPayload {
  model?: unknown;
  error?: { message?: unknown } | string | null;
  choices?: Array<{ delta?: { content?: unknown }; message?: { content?: unknown }; finish_reason?: unknown }>;
}

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '')}/${path}`;
}

export function buildMessages(messages: ChatMessage[], systemPrompt?: string): ChatMessage[] {
  const system = systemPrompt?.trim();
  return system ? [{ role: 'system', content: system }, ...messages] : [...messages];
}

/** Links an optional caller signal to an internal controller with a re-armable timer. */
function abortScope(external?: AbortSignal) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const forward = () => controller.abort(external?.reason);
  if (external?.aborted) forward();
  else external?.addEventListener('abort', forward, { once: true });
  return {
    signal: controller.signal,
    isTimedOut: () => timedOut,
    arm(ms: number) {
      clearTimeout(timer);
      if (ms > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, ms);
      }
    },
    dispose() {
      clearTimeout(timer);
      external?.removeEventListener('abort', forward);
    },
  };
}

type AbortScope = ReturnType<typeof abortScope>;

function parseJson<T>(text: string): T {
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === 'object') return value as T;
  } catch {
    // fall through to the typed error below
  }
  throw new LlmError('bad-response', 'Response was not valid JSON.', { detail: text.slice(0, 200) });
}

function payloadError(payload: CompletionPayload): string | null {
  if (!payload.error) return null;
  if (typeof payload.error === 'string') return payload.error;
  return typeof payload.error.message === 'string' ? payload.error.message : 'Unknown server error';
}

function applyPayload(result: ChatResult, payload: CompletionPayload, onDelta?: (delta: string) => void): void {
  if (result.model === null && typeof payload.model === 'string') result.model = payload.model;
  const choice = payload.choices?.[0];
  const text = choice?.delta?.content ?? choice?.message?.content;
  if (typeof text === 'string' && text) {
    result.content += text;
    onDelta?.(text);
  }
  if (typeof choice?.finish_reason === 'string') result.finishReason = choice.finish_reason;
}

async function httpError(response: Response): Promise<LlmError> {
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 500);
    detail = payloadError(parseJson<CompletionPayload>(detail)) ?? detail;
  } catch {
    // body unreadable or not JSON: keep whatever text we have
  }
  return new LlmError('http', `Model server returned HTTP ${response.status}.`, {
    status: response.status,
    detail: detail || undefined,
  });
}

export function createLlmClient(config: LlmConfig, deps: LlmClientDeps = {}): LlmClient {
  const doFetch: FetchLike = deps.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const isOnline = deps.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const idleTimeoutMs = config.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const retries = Math.max(0, config.retries ?? 0);

  /** Validates config at the boundary and fails fast instead of hanging. */
  function target(requireModel: boolean): URL {
    const raw = config.baseUrl?.trim() ?? '';
    if (!raw || (requireModel && !config.model?.trim())) {
      throw new LlmError('config', 'Base URL and model are required.');
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new LlmError('config', 'Base URL is not a valid URL.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new LlmError('config', 'Base URL must start with http:// or https://.');
    }
    // A model on this device still answers without a network, so only remote hosts fail fast.
    if (!isOnline() && !isLoopbackUrl(url)) {
      throw new LlmError('offline', 'Offline, and the model is not on this device.');
    }
    return url;
  }

  function headers(json: boolean): Record<string, string> {
    const result: Record<string, string> = { Accept: 'text/event-stream, application/json' };
    if (json) result['Content-Type'] = 'application/json';
    const key = config.apiKey?.trim();
    if (key) result.Authorization = `Bearer ${key}`;
    return result;
  }

  function classify(err: unknown, scope: AbortScope, url: URL): LlmError {
    if (err instanceof LlmError) return err;
    if (scope.isTimedOut()) return new LlmError('timeout', 'The model did not respond in time.', { cause: err });
    if (scope.signal.aborted) return new LlmError('aborted', 'Request was cancelled.', { cause: err });
    if (!isOnline() && !isLoopbackUrl(url)) return new LlmError('offline', 'Connection lost.', { cause: err });
    // fetch() rejects with a bare TypeError for refused connections, DNS failures, CORS and CSP blocks alike.
    return new LlmError('unreachable', 'Could not reach the model server.', { cause: err });
  }

  async function send(url: URL, path: string, init: RequestInit, scope: AbortScope): Promise<Response> {
    scope.arm(timeoutMs);
    const response = await doFetch(joinUrl(url.href, path), {
      ...init,
      signal: scope.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
    if (!response.ok) throw await httpError(response);
    return response;
  }

  async function readStream(response: Response, scope: AbortScope, request: ChatRequest, progress: { emitted: boolean }): Promise<ChatResult> {
    if (!response.body) throw new LlmError('bad-response', 'Streaming response had no body.');
    const result: ChatResult = { content: '', finishReason: null, model: null };
    scope.arm(idleTimeoutMs);
    const events = readSseData(response.body, { signal: scope.signal, onChunk: () => scope.arm(idleTimeoutMs) });
    for await (const data of events) {
      if (data === '[DONE]') break;
      const payload = parseJson<CompletionPayload>(data);
      const serverError = payloadError(payload);
      if (serverError) throw new LlmError('http', 'Model server reported an error mid-stream.', { detail: serverError });
      applyPayload(result, payload, (delta) => {
        progress.emitted = true;
        request.onToken?.(delta, result.content);
      });
    }
    return result;
  }

  async function chat(request: ChatRequest): Promise<ChatResult> {
    const url = target(true);
    const stream = request.stream ?? true;
    const body = JSON.stringify({
      model: config.model.trim(),
      messages: buildMessages(request.messages, request.systemPrompt),
      stream,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
    });

    for (let attempt = 0; ; attempt++) {
      const scope = abortScope(request.signal);
      const progress = { emitted: false };
      try {
        const response = await send(url, 'chat/completions', { method: 'POST', headers: headers(true), body }, scope);
        const type = response.headers.get('content-type') ?? '';
        if (stream && !type.includes('application/json')) return await readStream(response, scope, request, progress);

        // Non-streaming request, or a server that ignored stream: true.
        const payload = parseJson<CompletionPayload>(await response.text());
        const serverError = payloadError(payload);
        if (serverError) throw new LlmError('http', 'Model server reported an error.', { detail: serverError });
        const result: ChatResult = { content: '', finishReason: null, model: null };
        applyPayload(result, payload, (delta) => request.onToken?.(delta, result.content));
        return result;
      } catch (err) {
        const error = classify(err, scope, url);
        const retryable = error.kind === 'unreachable' || (error.kind === 'http' && (error.status === 429 || (error.status ?? 0) >= 500));
        if (attempt >= retries || progress.emitted || !retryable) throw error;
      } finally {
        scope.dispose();
      }
    }
  }

  async function listModels(signal?: AbortSignal): Promise<string[]> {
    const url = target(false);
    const scope = abortScope(signal);
    try {
      const response = await send(url, 'models', { method: 'GET', headers: headers(false) }, scope);
      const payload = parseJson<{ data?: Array<{ id?: unknown }> }>(await response.text());
      if (!Array.isArray(payload.data)) return [];
      return payload.data.map((model) => model?.id).filter((id): id is string => typeof id === 'string');
    } catch (err) {
      throw classify(err, scope, url);
    } finally {
      scope.dispose();
    }
  }

  return { chat, listModels };
}
