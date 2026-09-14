import type { Settings } from '../settings/settings';
import type { AppRecord } from './store';

export interface ExportBundle {
  format: 'private-ai-starter/v1';
  exportedAt: string;
  settings: Omit<Settings, 'apiKey'>;
  records: AppRecord[];
}

export function buildExport(settings: Settings, records: AppRecord[], now: Date = new Date()): ExportBundle {
  // The API key never goes into an export file.
  const safe: Omit<Settings, 'apiKey'> & { apiKey?: string } = { ...settings };
  delete safe.apiKey;
  return { format: 'private-ai-starter/v1', exportedAt: now.toISOString(), settings: safe, records };
}

/** Saves JSON through a local blob URL. Nothing is uploaded. */
export function downloadJson(filename: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
