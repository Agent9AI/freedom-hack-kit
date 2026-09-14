// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createLlmClient, LlmError, PROVIDERS, type FetchLike } from '../src/llm';

const encoder = new TextEncoder();
const BASE = { baseUrl: 'http://localhost:11434/v1/', model: 'test-model' };
const MESSAGES = [{ role: 'user' as const, content: 'hi' }];

/** A Response whose body arrives in pieces of `pieceSize` bytes, like a slow network. */
function streamResponse(text: string, pieceSize = 3): Response {
  const bytes = encoder.encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += pieceSize) controller.enqueue(bytes.slice(i, i + pieceSize));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function sse(...payloads: unknown[]): string {
  return payloads.map((p) => `data: ${typeof p === 'string' ? p : JSON.stringify(p)}\r\n\r\n`).join('');
}

const delta = (content: string) => ({ model: 'test-model', choices: [{ delta: { content }, finish_reason: null }] });
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** fetch that never answers until its signal aborts, like a blackholed host. */
function hangingFetch() {
  return vi.fn<FetchLike>(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        const fail = () => reject(new DOMException('Aborted', 'AbortError'));
        if (init.signal?.aborted) fail();
        init.signal?.addEventListener('abort', fail);
      }),
  );
}

async function failure(promise: Promise<unknown>): Promise<LlmError> {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(LlmError);
  return error as LlmError;
}

describe('streaming chat', () => {
  it('assembles tokens split across arbitrary chunk boundaries, including multi-byte characters', async () => {
    const body = sse(delta('Hel'), delta('lo, '), delta('سلام'), delta(' мир'), { choices: [{ delta: {}, finish_reason: 'stop' }] }, '[DONE]');
    const fetch = vi.fn<FetchLike>(async () => streamResponse(body, 3));
    const tokens: string[] = [];
    const client = createLlmClient({ ...BASE, apiKey: 'test-key' }, { fetch });

    const result = await client.chat({ messages: MESSAGES, systemPrompt: 'Be brief.', onToken: (d) => tokens.push(d) });

    expect(result).toEqual({ content: 'Hello, سلام мир', finishReason: 'stop', model: 'test-model' });
    expect(tokens).toEqual(['Hel', 'lo, ', 'سلام', ' мир']);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key', 'Content-Type': 'application/json' });
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'test-model',
      stream: true,
      messages: [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'hi' },
      ],
    });
  });

  it('handles one-byte chunks, keep-alive comments and a final event with no trailing blank line', async () => {
    const body = `: keep-alive\n\n${sse(delta('a'), delta('b'))}data: ${JSON.stringify(delta('c'))}`;
    const client = createLlmClient(BASE, { fetch: async () => streamResponse(body, 1) });
    expect((await client.chat({ messages: MESSAGES })).content).toBe('abc');
  });

  it('sends no Authorization header when no key is set', async () => {
    const fetch = vi.fn<FetchLike>(async () => streamResponse(sse(delta('ok'), '[DONE]')));
    await createLlmClient(BASE, { fetch }).chat({ messages: MESSAGES });
    expect(fetch.mock.calls[0]![1].headers).not.toHaveProperty('Authorization');
  });

  it('falls back to a JSON body when the server ignores stream: true', async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ model: 'm', choices: [{ message: { content: 'whole reply' }, finish_reason: 'stop' }] }));
    const result = await createLlmClient(BASE, { fetch }).chat({ messages: MESSAGES });
    expect(result).toEqual({ content: 'whole reply', finishReason: 'stop', model: 'm' });
  });
});

describe('errors degrade clearly instead of hanging', () => {
  it('surfaces HTTP errors with status and the server message', async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ error: { message: "model 'nope' not found" } }, 404));
    const error = await failure(createLlmClient(BASE, { fetch }).chat({ messages: MESSAGES }));
    expect(error).toMatchObject({ kind: 'http', status: 404, detail: "model 'nope' not found" });
  });

  it('surfaces an error event sent mid-stream', async () => {
    const fetch = vi.fn<FetchLike>(async () => streamResponse(sse(delta('par'), { error: { message: 'out of memory' } })));
    const error = await failure(createLlmClient(BASE, { fetch }).chat({ messages: MESSAGES }));
    expect(error).toMatchObject({ kind: 'http', detail: 'out of memory' });
  });

  it('rejects unreadable stream data as bad-response', async () => {
    const fetch = vi.fn<FetchLike>(async () => streamResponse('data: {not json}\n\n'));
    expect(await failure(createLlmClient(BASE, { fetch }).chat({ messages: MESSAGES }))).toMatchObject({ kind: 'bad-response' });
  });

  it('aborts with a timeout when the server never answers', async () => {
    const fetch = hangingFetch();
    const error = await failure(createLlmClient({ ...BASE, timeoutMs: 20 }, { fetch }).chat({ messages: MESSAGES }));
    expect(error.kind).toBe('timeout');
    expect(fetch.mock.calls[0]![1].signal?.aborted).toBe(true);
  });

  it('aborts with a timeout when a stream goes silent mid-answer', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sse(delta('partial')))); // then silence, never closes
      },
    });
    const fetch = vi.fn<FetchLike>(async () => new Response(body, { headers: { 'content-type': 'text/event-stream' } }));
    const tokens: string[] = [];
    const client = createLlmClient({ ...BASE, idleTimeoutMs: 30 }, { fetch });
    const error = await failure(client.chat({ messages: MESSAGES, onToken: (d) => tokens.push(d) }));
    expect(error.kind).toBe('timeout');
    expect(tokens).toEqual(['partial']);
  });

  it('reports a caller abort (Stop button) as aborted', async () => {
    const controller = new AbortController();
    const pending = failure(createLlmClient(BASE, { fetch: hangingFetch() }).chat({ messages: MESSAGES, signal: controller.signal }));
    controller.abort();
    expect((await pending).kind).toBe('aborted');
  });

  it('fails fast offline for a remote model, without calling fetch', async () => {
    const fetch = vi.fn<FetchLike>();
    const client = createLlmClient({ baseUrl: 'https://model-host.test/v1', model: 'm' }, { fetch, isOnline: () => false });
    expect((await failure(client.chat({ messages: MESSAGES }))).kind).toBe('offline');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('still tries a model on this device while offline', async () => {
    const fetch = vi.fn<FetchLike>(async () => streamResponse(sse(delta('local works'), '[DONE]')));
    const client = createLlmClient({ baseUrl: 'http://127.0.0.1:8080/v1', model: 'm' }, { fetch, isOnline: () => false });
    expect((await client.chat({ messages: MESSAGES })).content).toBe('local works');
  });

  it('reports a refused connection as unreachable', async () => {
    const fetch = vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    });
    expect((await failure(createLlmClient(BASE, { fetch }).chat({ messages: MESSAGES }))).kind).toBe('unreachable');
  });

  it('requires a valid http(s) base URL and a model before sending anything', async () => {
    const fetch = vi.fn<FetchLike>();
    for (const config of [{ baseUrl: '', model: 'm' }, { baseUrl: 'http://localhost:1/v1', model: ' ' }, { baseUrl: 'file:///etc/passwd', model: 'm' }]) {
      expect((await failure(createLlmClient(config, { fetch }).chat({ messages: MESSAGES }))).kind).toBe('config');
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('retries', () => {
  it('are off by default', async () => {
    const fetch = vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    });
    await failure(createLlmClient(BASE, { fetch }).chat({ messages: MESSAGES }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retry a 503 when enabled', async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ error: 'loading model' }, 503))
      .mockResolvedValueOnce(streamResponse(sse(delta('ready'), '[DONE]')));
    const result = await createLlmClient({ ...BASE, retries: 1 }, { fetch }).chat({ messages: MESSAGES });
    expect(result.content).toBe('ready');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('listModels and presets', () => {
  it('returns model ids from GET {baseUrl}/models', async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ data: [{ id: 'llama3-3-70b' }, { id: 'gpt-oss-120b' }, { nope: 1 }] }));
    const ids = await createLlmClient({ baseUrl: PROVIDERS.maple.baseUrl, model: '', apiKey: 'k' }, { fetch }).listModels();
    expect(ids).toEqual(['llama3-3-70b', 'gpt-oss-120b']);
    expect(fetch.mock.calls[0]![0]).toBe('http://localhost:8080/v1/models');
    expect(fetch.mock.calls[0]![1].method).toBe('GET');
  });

  it('ships the expected local presets', () => {
    expect(PROVIDERS['local-ollama'].baseUrl).toBe('http://localhost:11434/v1');
    expect(PROVIDERS['llama-cpp'].baseUrl).toBe('http://localhost:8080/v1');
    expect(PROVIDERS.maple.baseUrl).toBe('http://localhost:8080/v1');
    expect(PROVIDERS.custom.baseUrl).toBe('');
  });
});
