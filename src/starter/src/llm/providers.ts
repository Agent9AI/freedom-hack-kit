/**
 * Provider presets: the one config file to edit when adding a model backend.
 * Every value is only a default the user can override in Settings at runtime.
 * Nothing secret belongs here. API keys are typed into Settings and stay in this browser.
 */

export type ProviderId = 'local-ollama' | 'llama-cpp' | 'maple' | 'custom';

export interface ProviderPreset {
  id: ProviderId;
  baseUrl: string;
  /** Example model name shown as a placeholder, never sent unless the user types it. */
  modelHint: string;
  requiresApiKey: boolean;
  /** Presets that share a default port cannot run on the same machine at the same time. */
  defaultPort: number | null;
}

export const PROVIDERS: Record<ProviderId, ProviderPreset> = {
  'local-ollama': {
    id: 'local-ollama',
    baseUrl: 'http://localhost:11434/v1',
    modelHint: 'llama3.2:3b',
    requiresApiKey: false,
    defaultPort: 11434,
  },
  'llama-cpp': {
    id: 'llama-cpp',
    baseUrl: 'http://localhost:8080/v1',
    modelHint: 'local-model',
    requiresApiKey: false,
    defaultPort: 8080,
  },
  maple: {
    id: 'maple',
    // Maple Proxy (desktop app "Local Proxy", or the ghcr.io/opensecretcloud/maple-proxy Docker image)
    // serves an OpenAI-compatible API on localhost:8080 by default, and the port can be changed.
    // Source: https://blog.trymaple.ai/maple-proxy-documentation/
    // It collides with the llama.cpp default. Model IDs differ from the doc examples, so use "Fetch models".
    baseUrl: 'http://localhost:8080/v1',
    modelHint: 'use Fetch models',
    requiresApiKey: true,
    defaultPort: 8080,
  },
  custom: {
    id: 'custom',
    baseUrl: '',
    modelHint: 'model-name',
    requiresApiKey: false,
    defaultPort: null,
  },
};

export const DEFAULT_PROVIDER: ProviderId = 'local-ollama';
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_IDLE_TIMEOUT_MS = 60_000;

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && Object.hasOwn(PROVIDERS, value);
}

/** Other presets that default to the same port, for the "cannot run together" note in Settings. */
export function portConflicts(id: ProviderId): ProviderId[] {
  const port = PROVIDERS[id].defaultPort;
  if (port === null) return [];
  return (Object.keys(PROVIDERS) as ProviderId[]).filter((other) => other !== id && PROVIDERS[other].defaultPort === port);
}

export function isLoopbackUrl(url: URL): boolean {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\./.test(host);
}

/** True when an HTTPS page would be blocked (mixed content) from calling this model URL. */
export function isMixedContent(url: URL, pageProtocol: string): boolean {
  return pageProtocol === 'https:' && url.protocol === 'http:' && !isLoopbackUrl(url);
}
