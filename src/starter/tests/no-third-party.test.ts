// @vitest-environment node
/**
 * Guard for "zero third-party runtime requests": fails if shipped code references a URL
 * outside this device. Comments are skipped (documentation links do not load anything).
 * If you add a real model host, prefer typing it into Settings over hardcoding it here.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN = ['index.html', 'src', 'public'];
const TEXT_EXTENSIONS = new Set(['.ts', '.js', '.html', '.css', '.json', '.webmanifest', '.svg', '']);
const ALLOWED_HOSTS = [/^localhost$/, /^127\.0\.0\.1$/, /^www\.w3\.org$/];

function files(path: string): string[] {
  const full = join(ROOT, path);
  if (!statSync(full).isDirectory()) return [full];
  return readdirSync(full).flatMap((name) => files(join(path, name)));
}

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('#') || trimmed.startsWith('<!--');
}

describe('zero third-party requests', () => {
  it('references no external hosts in shipped source, markup or public assets', () => {
    const offenders: string[] = [];
    for (const file of SCAN.flatMap(files).filter((f) => TEXT_EXTENSIONS.has(extname(f)))) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (isCommentLine(line)) return;
          for (const match of line.matchAll(/https?:\/\/([a-z0-9[][^\s/'"`<>);,]*)/gi)) {
            const host = match[1]!.replace(/:\d+$/, '');
            if (!ALLOWED_HOSTS.some((allowed) => allowed.test(host))) offenders.push(`${relative(ROOT, file)}:${index + 1} ${match[0]}`);
          }
          if (/(src|href)\s*=\s*["']\/\//.test(line)) offenders.push(`${relative(ROOT, file)}:${index + 1} protocol-relative URL`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
