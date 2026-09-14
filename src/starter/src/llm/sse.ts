/**
 * Minimal Server-Sent Events parsing for OpenAI-style streaming responses.
 * Network chunks may split anywhere: mid-line, mid-event, or inside a multi-byte UTF-8 character.
 */
export class SseParser {
  private buffer = '';
  private data: string[] = [];

  /** Feeds decoded text and returns the data payload of every event it completed. */
  push(text: string): string[] {
    this.buffer += text;
    const events: string[] = [];
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newline + 1);
      this.line(line, events);
    }
    return events;
  }

  /** Call once at the end of the stream: emits a final event that had no trailing blank line. */
  flush(): string[] {
    const events: string[] = [];
    if (this.buffer) this.line(this.buffer.replace(/\r$/, ''), events);
    this.buffer = '';
    this.line('', events);
    return events;
  }

  private line(line: string, events: string[]): void {
    if (line === '') {
      if (this.data.length) events.push(this.data.join('\n'));
      this.data = [];
      return;
    }
    if (line.startsWith(':')) return; // comment or keep-alive
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    if (field !== 'data') return; // event, id and retry are unused by chat completions
    const value = colon === -1 ? '' : line.slice(colon + 1);
    this.data.push(value.startsWith(' ') ? value.slice(1) : value);
  }
}

export interface ReadSseOptions {
  signal?: AbortSignal;
  /** Called whenever bytes arrive, used to re-arm the idle timeout. */
  onChunk?: () => void;
}

/** Yields each SSE data payload from a response body. Cancels the body when aborted or when the caller stops early. */
export async function* readSseData(body: ReadableStream<Uint8Array>, options: ReadSseOptions = {}): AsyncGenerator<string> {
  const { signal, onChunk } = options;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  const cancel = () => {
    reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      onChunk?.();
      yield* parser.push(decoder.decode(value, { stream: true }));
    }
    yield* parser.push(decoder.decode());
    yield* parser.flush();
  } finally {
    signal?.removeEventListener('abort', cancel);
    cancel();
  }
}
