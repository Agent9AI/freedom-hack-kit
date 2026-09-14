/**
 * Random hex string. Uses crypto.getRandomValues, which (unlike crypto.randomUUID)
 * also works when the app is served over plain HTTP on a local network.
 */
export function randomHex(bytes = 16): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}
