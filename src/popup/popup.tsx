import { useEffect, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { PreferencesStore, type Preferences } from '../core/storage/preferences';

const store = new PreferencesStore();

type PreferenceUpdater = (patch: Partial<Preferences>) => Promise<void>;

const SELECT_FIELDS: Array<{
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  getValue: (prefs: Preferences) => string;
  setValue: (value: string, update: PreferenceUpdater) => void;
}> = [
  {
    id: 'tone',
    label: 'Tone',
    options: [
      { value: 'professional', label: 'Professional' },
      { value: 'formal', label: 'Formal' },
      { value: 'casual', label: 'Casual' },
      { value: 'creative', label: 'Creative' },
    ],
    getValue: (prefs) => prefs.tone,
    setValue: (value, update) => void update({ tone: value as Preferences['tone'] }),
  },
  {
    id: 'format',
    label: 'Format',
    options: [
      { value: 'plain-text', label: 'Plain Text' },
      { value: 'markdown', label: 'Markdown' },
    ],
    getValue: (prefs) => prefs.format,
    setValue: (value, update) => void update({ format: value as Preferences['format'] }),
  },
  {
    id: 'length',
    label: 'Length',
    options: [
      { value: 'as-is', label: 'As-Is' },
      { value: 'shorter', label: 'Shorter' },
      { value: 'longer', label: 'Longer' },
    ],
    getValue: (prefs) => prefs.length,
    setValue: (value, update) => void update({ length: value as Preferences['length'] }),
  },
  {
    id: 'completionLanguage',
    label: 'Completion Language',
    options: [
      { value: 'auto', label: 'Auto (based on browser)' },
      { value: 'en', label: 'English' },
      { value: 'ja', label: 'Japanese' },
      { value: 'es', label: 'Spanish' },
    ],
    getValue: (prefs) => prefs.completionLanguage,
    setValue: (value, update) =>
      void update({ completionLanguage: value as Preferences['completionLanguage'] }),
  },
];

const NUMERIC_FIELDS: Array<{
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  getValue: (prefs: Preferences) => number;
  setValue: (value: number, update: PreferenceUpdater) => void;
}> = [
  {
    id: 'temperature',
    label: 'Temperature',
    min: 0,
    max: 1,
    step: 0.1,
    getValue: (prefs) => prefs.temperature,
    setValue: (value, update) => void update({ temperature: value }),
  },
  {
    id: 'topK',
    label: 'Top-K',
    min: 1,
    max: 40,
    step: 1,
    getValue: (prefs) => prefs.topK,
    setValue: (value, update) => void update({ topK: value }),
  },
  {
    id: 'maxTokens',
    label: 'Max Tokens',
    min: 16,
    max: 512,
    step: 16,
    getValue: (prefs) => prefs.maxTokens,
    setValue: (value, update) => void update({ maxTokens: value }),
  },
];

function usePreferences(): {
  prefs: Preferences | null;
  update: (patch: Partial<Preferences>) => Promise<void>;
} {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  useEffect(() => {
    void (async (): Promise<void> => {
      setPrefs(await store.get());
    })();
  }, []);
  const update = async (patch: Partial<Preferences>): Promise<void> => {
    await store.set(patch);
    setPrefs(await store.get());
  };
  return { prefs, update } as const;
}

function ProviderRow({
  prefs,
  update,
}: {
  prefs: Preferences;
  update: (p: Partial<Preferences>) => Promise<void>;
}): ReactElement {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="provider">Provider</label>
      <select
        id="provider"
        className="border rounded px-2 py-1"
        value={prefs.provider}
        onChange={(e) =>
          void update({ provider: e.currentTarget.value as Preferences['provider'] })
        }
      >
        <option value="chrome-ai">Chrome AI (On‑device)</option>
        <option value="openai">OpenAI API (Cloud)</option>
      </select>
    </div>
  );
}

function BasicRows({
  prefs,
  update,
}: {
  prefs: Preferences;
  update: PreferenceUpdater;
}): ReactElement {
  return (
    <>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={prefs.enabled}
          onChange={(e) => void update({ enabled: e.currentTarget.checked })}
        />
        Enable
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        <input
          type="checkbox"
          checked={prefs.includePromptDebugContext}
          onChange={(e) =>
            void update({ includePromptDebugContext: e.currentTarget.checked })
          }
        />
        Include prompt debug context (assembled + window)
      </label>
      <p className="ml-6 text-xs text-zinc-500 dark:text-zinc-400">
        Enabling this adds extra prompt metadata and may slow completions slightly.
      </p>
      {SELECT_FIELDS.map((field) => (
        <PreferenceSelect
          key={field.id}
          id={field.id}
          label={field.label}
          value={field.getValue(prefs)}
          options={field.options}
          onChange={(value) => field.setValue(value, update)}
        />
      ))}
    </>
  );
}

function NumericRows({
  prefs,
  update,
}: {
  prefs: Preferences;
  update: PreferenceUpdater;
}): ReactElement {
  return (
    <>
      {NUMERIC_FIELDS.map((field) => (
        <NumericInput
          key={field.id}
          id={field.id}
          label={field.label}
          value={field.getValue(prefs)}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(value) => field.setValue(value, update)}
        />
      ))}
    </>
  );
}

function OpenAIRows({
  prefs,
  update,
}: {
  prefs: Preferences;
  update: (p: Partial<Preferences>) => Promise<void>;
}): ReactElement | null {
  if (prefs.provider !== 'openai') return null;
  return (
    <>
      <div className="mt-2 text-xs text-amber-600">
        Note: Using OpenAI sends text to OpenAI servers. Your API key is stored locally via
        chrome.storage.
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="openaiModel">OpenAI Model</label>
        <input
          id="openaiModel"
          className="border rounded px-2 py-1 w-48"
          value={prefs.openaiModel ?? ''}
          onChange={(e) => void update({ openaiModel: e.currentTarget.value })}
          placeholder="gpt-4o-mini"
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="openaiApiKey">OpenAI API Key</label>
        <input
          id="openaiApiKey"
          type="password"
          className="border rounded px-2 py-1 w-64"
          value={prefs.openaiApiKey ?? ''}
          onChange={(e) => void update({ openaiApiKey: e.currentTarget.value })}
          placeholder="sk-..."
        />
      </div>
    </>
  );
}

function App(): ReactElement {
  const { prefs, update } = usePreferences();
  if (!prefs) return <div className="p-2">Loading…</div>;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold">AI Completion Settings</h3>
      <ProviderRow prefs={prefs} update={update} />
      {prefs.provider === 'chrome-ai' && <ModelDownloadSection />}
      <BasicRows prefs={prefs} update={update} />
      <NumericRows prefs={prefs} update={update} />
      {prefs.provider === 'chrome-ai' && (
        <p className="text-xs muted">All processing is local. No data is sent to any server.</p>
      )}
      <OpenAIRows prefs={prefs} update={update} />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

function ModelDownloadSection(): ReactElement {
  const { availability, progress, busy, checkAvailability, downloadModel } = useModelDownload();
  const label = labelForAvailability(availability);
  const canDownload = availability !== 'available' && !busy;
  return (
    <div className="flex flex-col gap-2 border rounded p-2">
      <div className="text-sm font-medium">On‑device Model</div>
      <div className="text-xs text-gray-600">
        Install Gemini Nano locally to enable private, offline suggestions.
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs">Status: {label}</span>
        <button
          className="border rounded px-2 py-1 text-xs"
          onClick={() => void checkAvailability()}
          disabled={busy}
        >
          Check
        </button>
        <button
          className="border rounded px-2 py-1 text-xs"
          onClick={() => void downloadModel()}
          disabled={!canDownload}
        >
          {availability === 'downloadable' ? 'Download' : 'Re-download'}
        </button>
        {progress !== null && availability !== 'available' && (
          <span className="text-xs">{progress}%</span>
        )}
      </div>
    </div>
  );
}

function useModelDownload(): {
  availability: ChromeAI.Availability;
  progress: number | null;
  busy: boolean;
  checkAvailability: () => Promise<void>;
  downloadModel: () => Promise<void>;
} {
  const [availability, setAvailability] = useState<ChromeAI.Availability>('unavailable');
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const readAvailability = async (): Promise<void> => {
    const model = getLanguageModel();
    setAvailability(model ? await model.availability() : 'unavailable');
  };

  useEffect(() => {
    void readAvailability();
  }, []);

  const downloadModel = async (): Promise<void> => {
    const model = getLanguageModel();
    if (!model) return;
    setBusy(true);
    setProgress(0);
    try {
      const session = await model.create({
        outputLanguage: chooseOutputLanguage(),
        monitor: createProgressMonitor(setProgress),
      });
      destroyQuietly(session);
      setAvailability('available');
    } catch {
      await readAvailability();
    } finally {
      setBusy(false);
    }
  };

  return {
    availability,
    progress,
    busy,
    checkAvailability: readAvailability,
    downloadModel,
  };
}

function getLanguageModel(): ChromeAI.LanguageModelAPI | undefined {
  return (globalThis as { LanguageModel?: ChromeAI.LanguageModelAPI }).LanguageModel;
}

function labelForAvailability(availability: ChromeAI.Availability): string {
  if (availability === 'available') return 'Installed';
  if (availability === 'downloadable') return 'Not installed';
  if (availability === 'downloading') return 'Downloading…';
  return 'Unavailable';
}

function PreferenceSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="border rounded px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumericInput({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}): ReactElement {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        className="border rounded px-2 py-1 w-24"
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
    </div>
  );
}

function createProgressMonitor(
  setProgress: (value: number | null) => void
): (monitor: ChromeAI.DownloadMonitor) => void {
  return (monitor) => {
    monitor.addEventListener('downloadprogress', (event) =>
      setProgress(Math.round(event.loaded * 100))
    );
  };
}

function destroyQuietly(session: ChromeAI.AISession): void {
  try {
    session.destroy();
  } catch {
    // ignore
  }
}

function chooseOutputLanguage(): 'en' | 'es' | 'ja' {
  const lang = (navigator?.language || 'en').toLowerCase();
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('es')) return 'es';
  return 'en';
}
