export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return typeof reason === 'string' ? reason : String(reason);
}

/** Rejects with `message` if `promise` has not settled within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(handle));
}

export function newestEvent<T extends { created_at: number }>(events: readonly T[]): T | undefined {
  let best: T | undefined;
  for (const event of events) {
    if (!best || event.created_at > best.created_at) best = event;
  }
  return best;
}
