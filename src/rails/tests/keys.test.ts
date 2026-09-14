import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { bytesToHex } from 'nostr-tools/utils';
import {
  RailsValidationError,
  createIdentity,
  exportEncryptedKey,
  exportNsec,
  importEncryptedKey,
  importIdentity,
  parsePublicKey,
  redact,
  toNpub,
} from '../src/index.js';

describe('keys', () => {
  it('round-trips an identity through nsec and hex', () => {
    const id = createIdentity();
    expect(id.npub.startsWith('npub1')).toBe(true);
    const nsec = exportNsec(id);
    expect(nsec.startsWith('nsec1')).toBe(true);
    expect(importIdentity(nsec).publicKey).toBe(id.publicKey);
    const hex = bytesToHex(id.secretKey);
    expect(importIdentity(hex).npub).toBe(id.npub);
    expect(importIdentity(`  ${hex.toUpperCase()}  `).publicKey).toBe(id.publicKey);
    expect(parsePublicKey(id.npub)).toBe(id.publicKey);
    expect(toNpub(id.publicKey)).toBe(id.npub);
  });

  it('matches the NIP-19 spec test vectors', () => {
    expect(parsePublicKey('npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg')).toBe(
      '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
    );
    // opsec-audit: allow public NIP-19 spec test vector, not a real key
    const id = importIdentity('nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5');
    expect(bytesToHex(id.secretKey)).toBe('67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa');
  });

  it('keeps the secret key out of JSON, Object.keys and console output', () => {
    const id = createIdentity();
    const hex = bytesToHex(id.secretKey);
    expect(Object.keys(id)).not.toContain('secretKey');
    expect(JSON.stringify(id)).not.toContain(hex);
    const printed = inspect(id);
    expect(printed).toContain('[redacted]');
    expect(printed).not.toContain(hex);
    expect(id.secretKey).toHaveLength(32);
  });

  it('rejects malformed keys with errors that never echo the input', () => {
    const id = createIdentity();
    const nsec = exportNsec(id);
    const corrupted = `${nsec.slice(0, -1)}${nsec.endsWith('q') ? 'p' : 'q'}`;
    expect(() => importIdentity(corrupted)).toThrow(RailsValidationError);
    try {
      importIdentity(corrupted);
    } catch (error) {
      expect((error as Error).message).not.toContain(corrupted);
    }
    expect(() => importIdentity(id.npub)).toThrow(/public key/);
    expect(() => importIdentity('00'.repeat(32))).toThrow(/not a valid/);
    expect(() => importIdentity('hello')).toThrow(RailsValidationError);
    expect(() => parsePublicKey('npub1notreal')).toThrow(RailsValidationError);
    expect(() => parsePublicKey(`${id.npub.slice(0, -1)}x`)).toThrow(RailsValidationError);
    expect(() => parsePublicKey(nsec)).toThrow(/SECRET key/);
    expect(() => parsePublicKey('abc123')).toThrow(RailsValidationError);
  });

  it('redact masks secrets and leaves ordinary text alone', () => {
    const id = createIdentity();
    const nsec = exportNsec(id);
    const hex = bytesToHex(id.secretKey);
    expect(redact(id.secretKey)).toBe('[redacted secret key]');
    expect(redact(hex)).toBe('[redacted hex key]');
    const line = redact(`import failed for ${nsec} at step 2`);
    expect(line).not.toContain(nsec);
    expect(line).toContain('nsec1[redacted]');
    const uri = redact(`nostr+walletconnect://${id.publicKey}?relay=wss://r.example&secret=${hex}`);
    expect(uri).toContain('secret=[redacted]');
    expect(uri).not.toContain(hex);
    expect(redact('hello world')).toBe('hello world');
  });

  it('NIP-49 password backup round-trips and rejects a wrong password', { timeout: 60_000 }, () => {
    const id = createIdentity();
    const backup = exportEncryptedKey(id, 'correct horse battery');
    expect(backup.startsWith('ncryptsec1')).toBe(true);
    expect(importEncryptedKey(backup, 'correct horse battery').publicKey).toBe(id.publicKey);
    expect(() => importEncryptedKey(backup, 'wrong password!')).toThrow(/wrong password/);
    expect(() => exportEncryptedKey(id, 'short')).toThrow(RailsValidationError);
    expect(() => exportEncryptedKey(id, 'long enough pw', 10)).toThrow(/at least 16/);
  });
});
