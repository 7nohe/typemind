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
  pending?: boolean | undefined;
  suggestions?: readonly string[] | undefined;
  selectedIndex?: number | undefined;
  onSelect?: (index: number) => void;
  acceptLabel?: string | undefined;
}

export function SuggestionOverlay({ x, y, visible, ...rest }: Props): ReactElement | null {
  if (!visible) return null;
  return (
    <div
      className="ai-overlay"
      style={{ left: `${x}px`, top: `${y}px` }}
      role="dialog"
      aria-label="AI suggestion"
    >
      <OverlayCard {...rest} />
    </div>
  );
}

interface OverlayCardProps {
  text: string;
  onAccept: () => void;
  onDismiss: () => void;
  notice?: string | undefined;
  loading?: boolean | undefined;
  pending?: boolean | undefined;
  suggestions?: readonly string[] | undefined;
  selectedIndex?: number | undefined;
  onSelect?: (index: number) => void;
  acceptLabel?: string | undefined;
}

function OverlayCard({
  text,
  onAccept,
  onDismiss,
  notice,
  loading,
  pending,
  suggestions,
  selectedIndex = 0,
  onSelect,
  acceptLabel = 'Tab',
}: OverlayCardProps): ReactElement {
  const hasText = text.trim().length > 0;
  const isGenerating = Boolean(loading || pending);
  const showGeneratingNotice = isGenerating && !hasText;
  const totalSuggestions = Array.isArray(suggestions) ? suggestions.length : 0;
  const hasMultipleSuggestions = totalSuggestions > 1 && Boolean(onSelect);

  const cycleSuggestion = (direction: 1 | -1): void => {
    if (!hasMultipleSuggestions || !onSelect) return;
    const nextIndex = (selectedIndex + direction + totalSuggestions) % totalSuggestions;
    onSelect(nextIndex);
  };

  return (
    <div className="bg-gray-50 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 shadow-xl rounded-lg p-2 max-w-sm animate-in fade-in-0 zoom-in-95">
      <OverlayNotice generating={showGeneratingNotice} notice={notice} />
      {hasText && (
        <>
          <div className="whitespace-pre-wrap text-sm">{text}</div>
          {hasMultipleSuggestions && (
            <NavigationControls
              current={selectedIndex}
              total={totalSuggestions}
              onPrev={() => cycleSuggestion(-1)}
              onNext={() => cycleSuggestion(1)}
            />
          )}
        </>
      )}
      <ActionButtons
        onAccept={onAccept}
        onDismiss={onDismiss}
        acceptLabel={acceptLabel}
        disabled={!hasText}
      />
    </div>
  );
}

function OverlayNotice({
  generating,
  notice,
}: {
  generating?: boolean | undefined;
  notice?: string | undefined;
}): ReactElement | null {
  if (!generating && !notice) return null;
  return (
    <div className="flex items-center gap-2 mb-1 text-[11px] text-zinc-500">
      {generating && (
        <div role="status">
          <svg aria-hidden="true" className="inline w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-gray-600 dark:fill-gray-300" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
            <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
          </svg>
          <span className="sr-only">Loading...</span>
        </div>
      )}
      {notice && <span>{notice}</span>}
    </div>
  );
}

function NavigationControls({
  current,
  total,
  onPrev,
  onNext,
}: {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}): ReactElement {
  return (
    <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
      <span>
        Suggestion {current + 1} / {total}
      </span>
      <div className="flex gap-1">
        <OverlayButton onClick={onPrev} icon="prev" label="Prev (Opt+[)" />
        <OverlayButton onClick={onNext} icon="next" label="Next (Opt+])" />
      </div>
    </div>
  );
}

function ActionButtons({
  onAccept,
  onDismiss,
  acceptLabel,
  disabled,
}: {
  onAccept: () => void;
  onDismiss: () => void;
  acceptLabel: string;
  disabled?: boolean;
}): ReactElement {
  return (
    <div className="flex gap-1 mt-2">
      <OverlayButton
        onClick={onAccept}
        icon="check"
        label={`Accept (${acceptLabel})`}
        disabled={disabled === true}
      />
      <OverlayButton onClick={onDismiss} icon="close" label="Dismiss (Esc)" />
    </div>
  );
}

function OverlayButton({
  onClick,
  label,
  icon,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  icon: 'check' | 'close' | 'prev' | 'next';
  disabled?: boolean;
}): ReactElement {
  const path =
    icon === 'check'
      ? 'M16.704 5.296a1 1 0 0 1 0 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3-3a1 1 0 1 1 1.414-1.414L8.75 11.586l6.543-6.543a1 1 0 0 1 1.411.253z'
      : icon === 'close'
        ? 'M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z'
        : icon === 'prev'
          ? 'M12.78 4.22a.75.75 0 0 1 0 1.06L8.53 9.53l4.25 4.25a.75.75 0 0 1-1.06 1.06l-4.78-4.78a.75.75 0 0 1 0-1.06l4.78-4.78a.75.75 0 0 1 1.06 0z'
          : 'M7.22 4.22a.75.75 0 0 1 1.06 0l4.78 4.78a.75.75 0 0 1 0 1.06l-4.78 4.78a.75.75 0 0 1-1.06-1.06l4.25-4.25-4.25-4.25a.75.75 0 0 1 0-1.06z';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-xs inline-flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-zinc-100 disabled:dark:hover:bg-zinc-700"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
        <path fillRule="evenodd" d={path} clipRule="evenodd" />
      </svg>
      {label}
    </button>
  );
}
