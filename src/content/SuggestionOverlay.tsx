/* React in automatic runtime: no explicit import needed */

import type { ReactElement } from 'react';

interface Props {
  text: string;
  x: number;
  y: number;
  onAccept: () => void;
  onDismiss: () => void;
  visible: boolean;
  notice?: string | undefined;
  loading?: boolean | undefined;
  suggestions?: readonly string[] | undefined;
  selectedIndex?: number | undefined;
  onSelect?: (index: number) => void;
  acceptLabel?: string | undefined;
}

export function SuggestionOverlay({
  text,
  x,
  y,
  onAccept,
  onDismiss,
  visible,
  notice,
  loading,
  suggestions,
  selectedIndex = 0,
  onSelect,
  acceptLabel = 'Tab',
}: Props): ReactElement | null {
  if (!visible) return null;
  return (
    <div
      className="ai-overlay"
      style={{ left: `${x}px`, top: `${y}px` }}
      role="dialog"
      aria-label="AI suggestion"
    >
      <div className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 shadow-xl rounded-lg p-2 max-w-sm animate-in fade-in-0 zoom-in-95">
        <OverlayNotice loading={loading} notice={notice} />
        <div className="whitespace-pre-wrap text-sm">{text}</div>
        <SuggestionsList
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          {...(onSelect ? { onSelect } : {})}
        />
        <ActionButtons onAccept={onAccept} onDismiss={onDismiss} acceptLabel={acceptLabel} />
      </div>
    </div>
  );
}

function OverlayNotice({
  loading,
  notice,
}: {
  loading?: boolean | undefined;
  notice?: string | undefined;
}): ReactElement | null {
  if (!loading && !notice) return null;
  return (
    <div className="flex items-center gap-2 mb-1 text-[11px] text-zinc-500">
      {loading && (
        <span
          className="inline-block h-3 w-3 border border-zinc-400 border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      )}
      {notice && <span>{notice}</span>}
      {loading && !notice && <span>Generating…</span>}
    </div>
  );
}

function SuggestionsList({
  suggestions,
  selectedIndex,
  onSelect,
}: {
  suggestions?: readonly string[] | undefined;
  selectedIndex: number;
  onSelect?: (index: number) => void;
}): ReactElement | null {
  if (!Array.isArray(suggestions) || suggestions.length <= 1) return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {suggestions.slice(0, 3).map((s, i) => (
        <button
          key={i}
          className={`text-left whitespace-pre-wrap text-[13px] px-2 py-1 rounded border ${
            i === selectedIndex
              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700'
              : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
          }`}
          onClick={() => onSelect?.(i)}
          aria-pressed={i === selectedIndex}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function ActionButtons({
  onAccept,
  onDismiss,
  acceptLabel,
}: {
  onAccept: () => void;
  onDismiss: () => void;
  acceptLabel: string;
}): ReactElement {
  return (
    <div className="flex gap-1 mt-2">
      <OverlayButton onClick={onAccept} icon="check" label={`Accept (${acceptLabel})`} />
      <OverlayButton onClick={onDismiss} icon="close" label="Dismiss (Esc)" />
    </div>
  );
}

function OverlayButton({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label: string;
  icon: 'check' | 'close';
}): ReactElement {
  const path =
    icon === 'check'
      ? 'M16.704 5.296a1 1 0 0 1 0 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3-3a1 1 0 1 1 1.414-1.414L8.75 11.586l6.543-6.543a1 1 0 0 1 1.411.253z'
      : 'M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z';
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-xs inline-flex items-center gap-1"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
        <path fillRule="evenodd" d={path} clipRule="evenodd" />
      </svg>
      {label}
    </button>
  );
}
