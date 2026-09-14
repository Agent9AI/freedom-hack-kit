import { t } from '../i18n';
import { PROVIDERS, createLlmClient, isMixedContent, isProviderId, portConflicts, type ProviderId } from '../llm';
import type { Settings } from '../settings/settings';
import { byId, errorMessage, setText } from './dom';

export interface SettingsPanelOptions {
  getSettings(): Settings;
  onSave(next: Settings): void;
}

export function mountSettingsPanel(options: SettingsPanelOptions): { open(): void } {
  const dialog = byId<HTMLDialogElement>('settings');
  const form = byId<HTMLFormElement>('settings-form');
  const provider = byId<HTMLSelectElement>('s-provider');
  const providerNote = byId('s-provider-note');
  const baseUrl = byId<HTMLInputElement>('s-baseUrl');
  const model = byId<HTMLInputElement>('s-model');
  const models = byId<HTMLDataListElement>('s-models');
  const apiKey = byId<HTMLInputElement>('s-apiKey');
  const remember = byId<HTMLInputElement>('s-remember');
  const system = byId<HTMLTextAreaElement>('s-system');
  const fetchModels = byId<HTMLButtonElement>('s-fetch');
  const status = byId('s-status');

  for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
    const option = document.createElement('option');
    option.value = id;
    setText(option, `provider.${id}`);
    provider.append(option);
  }

  function say(message: string, tone: 'info' | 'warn' | 'ok' = 'info'): void {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function selectedProvider(): ProviderId {
    return isProviderId(provider.value) ? provider.value : 'custom';
  }

  function describeProvider(): void {
    const id = selectedProvider();
    const notes: string[] = [];
    if (PROVIDERS[id].requiresApiKey) notes.push(t('settings.apiKeyRequired'));
    const [other] = portConflicts(id);
    if (other) notes.push(t('settings.portNote', { a: t(`provider.${id}`), b: t(`provider.${other}`) }));
    providerNote.textContent = notes.join('\n');
    providerNote.hidden = notes.length === 0;
    model.placeholder = PROVIDERS[id].modelHint;
  }

  /** Validates the URL as typed. Returns false only for an unusable value. */
  function checkUrl(): boolean {
    const value = baseUrl.value.trim();
    say('');
    if (!value) return true;
    let url: URL;
    try {
      url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol');
    } catch {
      say(t('settings.invalidUrl'), 'warn');
      return false;
    }
    if (isMixedContent(url, location.protocol)) say(t('settings.mixedContent'), 'warn');
    return true;
  }

  function fill(settings: Settings): void {
    provider.value = settings.provider;
    baseUrl.value = settings.baseUrl;
    model.value = settings.model;
    apiKey.value = settings.apiKey;
    remember.checked = settings.rememberKey;
    system.value = settings.systemPrompt;
    describeProvider();
    checkUrl();
  }

  function read(): Settings {
    return {
      ...options.getSettings(),
      provider: selectedProvider(),
      baseUrl: baseUrl.value.trim(),
      model: model.value.trim(),
      apiKey: apiKey.value.trim(),
      rememberKey: remember.checked,
      systemPrompt: system.value.trim(),
    };
  }

  provider.addEventListener('change', () => {
    baseUrl.value = PROVIDERS[selectedProvider()].baseUrl;
    describeProvider();
    checkUrl();
  });
  baseUrl.addEventListener('input', checkUrl);

  fetchModels.addEventListener('click', async () => {
    if (!checkUrl()) return;
    const draft = read();
    fetchModels.disabled = true;
    say(t('settings.fetching'));
    try {
      const ids = await createLlmClient({ baseUrl: draft.baseUrl, model: draft.model, apiKey: draft.apiKey, timeoutMs: 10_000 }).listModels();
      models.replaceChildren(...ids.map((id) => Object.assign(document.createElement('option'), { value: id })));
      if (!model.value && ids[0]) model.value = ids[0];
      say(t('settings.modelsFound', { count: ids.length }), 'ok');
    } catch (err) {
      say(errorMessage(err), 'warn');
    } finally {
      fetchModels.disabled = false;
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!checkUrl()) return;
    options.onSave(read());
    dialog.close();
  });
  byId('s-close').addEventListener('click', () => dialog.close());

  return {
    open() {
      fill(options.getSettings());
      dialog.showModal();
    },
  };
}
