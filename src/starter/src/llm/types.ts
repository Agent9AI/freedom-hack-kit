/** Typed interfaces for the OpenAI-compatible chat client. */

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface LlmConfig {
  /** Base URL including the version segment, for example ".../v1". Set at runtime, never hardcoded. */
  baseUrl: string;
  model: string;
  /** Optional bearer token. Only sent when non-empty. */
  apiKey?: string;
  /** Max wait for response headers, in ms. */
  timeoutMs?: number;
  /** Max silence between streamed chunks, in ms. */
  idleTimeoutMs?: number;
  /** Extra attempts after a network error, 429 or 5xx, only before any token arrived. Off (0) by default. */
  retries?: number;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Sent as the first message with role "system" when non-empty. */
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Stream tokens over SSE. Default true. */
  stream?: boolean;
  /** Called for every streamed text delta with the text assembled so far. */
  onToken?: (delta: string, soFar: string) => void;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  finishReason: string | null;
  model: string | null;
}

export type LlmErrorKind = 'config' | 'offline' | 'unreachable' | 'timeout' | 'http' | 'aborted' | 'bad-response';

export class LlmError extends Error {
  readonly kind: LlmErrorKind;
  readonly status?: number;
  /** Server-provided explanation. Show it as plain text only. */
  readonly detail?: string;

  constructor(kind: LlmErrorKind, message: string, options: { status?: number; detail?: string; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'LlmError';
    this.kind = kind;
    this.status = options.status;
    this.detail = options.detail;
  }
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface LlmClientDeps {
  fetch?: FetchLike;
  isOnline?: () => boolean;
}
