import './ui/styles.css';
import { buildExport, downloadJson } from './data/export';
import { DB_NAME, LocalStore } from './data/store';
import { panicWipe } from './data/wipe';
import { LOCALES, isLocale, setLocale, type Locale } from './i18n';
import { loadSettings, saveSettings, type Settings } from './settings/settings';
import { registerServiceWorker } from './sw/register';
import { mountChat } from './ui/chat';
import { byId, setText } from './ui/dom';
import { mountSettingsPanel } from './ui/settings-panel';

const store = new LocalStore();
let settings: Settings = loadSettings();

function updateSettings(next: Settings): void {
  settings = next;
  saveSettings(next);
}

function applyLocale(locale: Locale): void {
  setLocale(locale);
  byId('drafted').hidden = !LOCALES[locale].machineDrafted;
}

function mountLanguagePicker(): void {
  const select = byId<HTMLSelectElement>('lang');
  for (const [code, info] of Object.entries(LOCALES)) {
    const option = document.createElement('option');
    option.value = code;
    option.lang = code;
    option.textContent = info.name;
    select.append(option);
  }
  select.value = settings.locale;
  select.addEventListener('change', () => {
    if (!isLocale(select.value)) return;
    updateSettings({ ...settings, locale: select.value });
    applyLocale(select.value);
  });
}

function watchConnectivity(): void {
  const pill = byId('net');
  const hint = byId('offline-hint');
  const update = () => {
    const online = navigator.onLine !== false;
    setText(pill, online ? 'status.online' : 'status.offline');
    pill.dataset.state = online ? 'online' : 'offline';
    hint.hidden = online;
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function mountDataButtons(abortChat: () => void): void {
  byId('export').addEventListener('click', async () => {
    const records = await store.list().catch(() => []);
    // Generic file name: a download called "private-ai-..." is itself a tell on a seized device.
    downloadJson(`export-${new Date().toISOString().slice(0, 10)}.json`, buildExport(settings, records));
  });

  const wipe = byId<HTMLButtonElement>('wipe');
  let disarm: ReturnType<typeof setTimeout> | undefined;
  wipe.addEventListener('click', () => {
    if (wipe.dataset.armed !== 'true') {
      // Two taps within 4 seconds: fast in a panic, hard to trigger by accident.
      wipe.dataset.armed = 'true';
      setText(wipe, 'data.wipeConfirm');
      disarm = setTimeout(() => {
        delete wipe.dataset.armed;
        setText(wipe, 'data.wipe');
      }, 4000);
      return;
    }
    clearTimeout(disarm);
    wipe.disabled = true;
    setText(wipe, 'data.wiping');
    void panicWipe({
      knownDatabases: [DB_NAME],
      beforeWipe: () => {
        abortChat();
        store.destroy();
      },
    });
  });
}

applyLocale(settings.locale);
mountLanguagePicker();
watchConnectivity();
const chat = mountChat(store, () => settings);
const panel = mountSettingsPanel({ getSettings: () => settings, onSave: updateSettings });
byId('open-settings').addEventListener('click', () => panel.open());
mountDataButtons(() => chat.abort());
registerServiceWorker();
