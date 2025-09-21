import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { SuggestionOverlay } from './SuggestionOverlay';
import { trimSuggestions, trimSuggestionOverlap, sanitizeSuggestionText } from './suggestion-utils';
import { sliceContextAroundCaret } from './context-window';
import { debounce } from '../utils/debounce';
import { getTextAndCaret, isCaretAtLineEnd } from './caret-utils';
import { getActiveTextInput, type TextLikeElement } from './text-detector';
import type {
  AppMessage,
  CompletionRequestPayload,
  CompletionResponsePayload,
  WarmupRequestPayload,
} from '../types/completion.d';
import { deriveSessionScope } from '../core/completion/session-scope';
import { shouldPrefetchForKey } from './prefetch-detector';

type PendingListener = (count: number) => void;

const pendingListeners = new Set<PendingListener>();
let pendingCount = 0;

function notifyPending(): void {
  for (const listener of pendingListeners) listener(pendingCount);
}

function subscribePending(listener: PendingListener): () => void {
  pendingListeners.add(listener);
  listener(pendingCount);
  return () => pendingListeners.delete(listener);
}

function incrementPending(): void {
  pendingCount = Math.max(0, pendingCount + 1);
  notifyPending();
}

function decrementPending(): void {
  pendingCount = Math.max(0, pendingCount - 1);
  notifyPending();
}

function isCompletionResponsePayload(value: unknown): value is CompletionResponsePayload {
  return !!value && typeof value === 'object' && 'suggestions' in value;
}

function getCaretRect(el: TextLikeElement): DOMRectReadOnly {
  if (el instanceof HTMLTextAreaElement) return el.getBoundingClientRect();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return el.getBoundingClientRect();

  const range = sel.getRangeAt(0);
  if (!el.contains(range.endContainer)) return el.getBoundingClientRect();

  const rects = range.getClientRects();
  const last = rects.item(rects.length - 1);
  if (last) return last;

  const bounding = range.getBoundingClientRect();
  if (bounding.width > 0 || bounding.height > 0) return bounding;

  const marker = document.createElement('span');
  marker.setAttribute('data-ai-caret-marker', '');
  marker.style.position = 'relative';
  marker.style.display = 'inline-block';
  marker.style.width = '0px';
  marker.style.height = '1em';
  marker.style.pointerEvents = 'none';
  marker.style.opacity = '0';

  const caretRange = range.cloneRange();
  caretRange.collapse(true);
  caretRange.insertNode(marker);

  const rect = marker.getBoundingClientRect();

  marker.remove();
  // Restore original selection as inserting the marker can disturb it in some editors.
  sel.removeAllRanges();
  sel.addRange(range);

  if (rect.width > 0 || rect.height > 0) return rect;
  return el.getBoundingClientRect();
}

function buildMessage(el: TextLikeElement): AppMessage<CompletionRequestPayload> {
  const { text, caret } = getTextAndCaret(el);
  const contextText = sliceContextAroundCaret(text, caret);
  return {
    type: 'COMPLETION_REQUEST',
    payload: {
      inputText: text,
      cursorPosition: caret,
      contextMetadata: {
        pageTitle: document.title,
        url: location.href,
        domain: new URL(location.href).hostname,
        language: document.documentElement.getAttribute('lang') || navigator.language,
      },
      contextText,
    },
    correlationId: Math.random().toString(36).slice(2),
  };
}

type DebouncedSend = (() => void) & { flush: () => void };

interface SendRequestHandlers {
  setPos: (p: { x: number; y: number }) => void;
  setText: (t: string) => void;
  setVisible: (v: boolean) => void;
  setNotice: (n: string | undefined) => void;
  setLoading?: (b: boolean) => void;
  setChoices?: (arr: string[]) => void;
  setSelected?: (i: number) => void;
}

function createSendRequest(
  setPos: (p: { x: number; y: number }) => void,
  setText: (t: string) => void,
  setVisible: (v: boolean) => void,
  setNotice: (n: string | undefined) => void,
  setLoading?: (b: boolean) => void,
  setChoices?: (arr: string[]) => void,
  setSelected?: (i: number) => void
): DebouncedSend {
  let timer: number | undefined;
  const handlers: SendRequestHandlers = {
    setPos,
    setText,
    setVisible,
    setNotice,
  };
  if (setLoading) handlers.setLoading = setLoading;
  if (setChoices) handlers.setChoices = setChoices;
  if (setSelected) handlers.setSelected = setSelected;

  const run = async (): Promise<void> => {
    timer = undefined;
    await dispatchCompletionRequest(handlers);
  };
  const trigger: DebouncedSend = (() => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void run();
    }, COMPLETION_DEBOUNCE_MS);
  }) as DebouncedSend;
  trigger.flush = (): void => {
    if (timer) window.clearTimeout(timer);
    void run();
  };
  return trigger;
}

async function dispatchCompletionRequest(handlers: SendRequestHandlers): Promise<void> {
  const { setPos, setText, setVisible, setNotice } = handlers;
  const { setLoading, setChoices, setSelected } = handlers;

  const el = getActiveTextInput();
  if (!el) return;

  positionOverlay(el, setPos);
  setVisible(true);
  if (setLoading) {
    resetOverlayBeforeRequest(setLoading, setText, setChoices, setSelected, setNotice);
  }

  const message = buildMessage(el);
  incrementPending();

  try {
    const res: unknown = await chrome.runtime.sendMessage(message);
    handleResponse(
      el,
      res,
      setPos,
      setText,
      setChoices,
      setSelected,
      setNotice,
      setVisible,
      setLoading
    );
  } catch {
    if (setLoading) setLoading(false);
    setVisible(false);
  } finally {
    decrementPending();
  }
}

function createPrefetchRequest(): () => void {
  const fn = async (): Promise<void> => {
    const el = getActiveTextInput();
    if (!el) return;
    const message = buildMessage(el);
    const prefetchMessage: AppMessage<CompletionRequestPayload> = {
      type: 'COMPLETION_PREFETCH',
      payload: message.payload,
      correlationId: Math.random().toString(36).slice(2),
    };
    try {
      incrementPending();
      await chrome.runtime.sendMessage(prefetchMessage);
    } catch {
      // ignore prefetch errors
    } finally {
      decrementPending();
    }
  };
  return debounce(fn, 80);
}

function resetOverlayBeforeRequest(
  setLoading: (value: boolean) => void,
  setText: (value: string) => void,
  setChoices?: (value: string[]) => void,
  setSelected?: (i: number) => void,
  setNotice?: (value: string | undefined) => void
): void {
  setText('');
  setChoices?.([]);
  setSelected?.(0);
  setNotice?.(undefined);
  setLoading(true);
}

function handleResponse(
  el: TextLikeElement,
  response: unknown,
  setPos: (p: { x: number; y: number }) => void,
  setText: (t: string) => void,
  setChoices: ((arr: string[]) => void) | undefined,
  setSelected: ((i: number) => void) | undefined,
  setNotice: (n: string | undefined) => void,
  setVisible: (v: boolean) => void,
  setLoading?: (b: boolean) => void
): void {
  const payload = isCompletionResponsePayload(response) ? response : undefined;
  if (payload?.status === 'NEEDS_DOWNLOAD') {
    try {
      chrome.runtime.openOptionsPage();
    } catch {
      // ignore
    }
  }
  if (setLoading) setLoading(false);
  const { text: fullText, caret } = getTextAndCaret(el);
  const prefix = fullText.slice(0, caret);
  const suggestions = trimSuggestions(prefix, extractSuggestions(payload));
  const topSuggestion = suggestions[0];
  if (!topSuggestion) {
    setVisible(false);
    return;
  }
  positionOverlay(el, setPos);
  setChoices?.(suggestions);
  setSelected?.(0);
  setText(topSuggestion);
  const providerInfo = payload?.provider;
  const showNotice = providerInfo
    ? providerInfo.resolved === 'openai' || providerInfo.resolved !== providerInfo.preference
    : false;
  setNotice(showNotice && providerInfo ? providerLabel(providerInfo.resolved) : undefined);
  setVisible(true);
}

function extractSuggestions(payload: CompletionResponsePayload | undefined): string[] {
  const entries = (payload?.suggestions ?? []) as unknown[];
  return entries
    .flatMap((entry) => normalizeSuggestionEntry(entry))
    .map((text) => sanitizeSuggestionText(text))
    .filter((text): text is string => text.length > 0)
    .slice(0, 3);
}

function normalizeSuggestionEntry(entry: unknown): string[] {
  const visited = new WeakSet<object>();
  const extracted = extractTexts(entry, 0, visited);
  if (extracted.length > 0) return extracted;
  if (entry === null || entry === undefined) return [];
  if (typeof entry === 'string') return [entry];
  if (typeof entry === 'object') {
    const text = (entry as { text?: unknown }).text;
    if (typeof text === 'string') return [text];
  }
  const fallback = coerceToNonTrivialString(entry);
  return fallback ? [fallback] : [];
}

function extractTexts(value: unknown, depth: number, visited: WeakSet<object>): string[] {
  if (typeof value === 'string') return extractFromString(value, depth, visited);
  if (Array.isArray(value)) return extractFromArray(value, depth, visited);
  if (isRecord(value)) return extractFromObject(value, depth, visited);
  return [];
}

function extractFromString(text: string, depth: number, visited: WeakSet<object>): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (depth < 2 && looksLikeJson(trimmed)) {
    const parsed = safeJsonParse(trimmed);
    if (parsed !== undefined) {
      const nested = extractTexts(parsed, depth + 1, visited);
      if (nested.length > 0) return nested;
    }
  }
  return [text];
}

function extractFromArray(values: unknown[], depth: number, visited: WeakSet<object>): string[] {
  return values.flatMap((item) => extractTexts(item, depth + 1, visited));
}

const PRIORITIZED_KEYS: readonly string[] = ['text', 'value', 'content', 'message'];

function extractFromObject(
  value: Record<string, unknown>,
  depth: number,
  visited: WeakSet<object>
): string[] {
  if (visited.has(value)) return [];
  visited.add(value);

  const prioritizedResults = PRIORITIZED_KEYS.flatMap((key) =>
    extractTexts(value[key], depth + 1, visited)
  );
  if (prioritizedResults.length > 0) return prioritizedResults;

  const suggestionField = value.suggestions;
  if (Array.isArray(suggestionField)) {
    const suggestionResults = extractFromArray(suggestionField, depth + 1, visited);
    if (suggestionResults.length > 0) return suggestionResults;
  }

  for (const child of Object.values(value)) {
    if (child === value) continue;
    const nested = extractTexts(child, depth + 1, visited);
    if (nested.length > 0) return nested;
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceToNonTrivialString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim().length > 0 ? value : undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'object' || value === null) return undefined;
  return stringifyNonEmptyStructure(value);
}

function stringifyNonEmptyStructure(value: object): string | undefined {
  try {
    const json = JSON.stringify(value);
    if (json && json !== '{}' && json !== '[]') return json;
  } catch {
    // ignore parse issues
  }
  return undefined;
}

function looksLikeJson(text: string): boolean {
  if (text.length < 2) return false;
  const first = text[0];
  const last = text[text.length - 1];
  return (first === '{' && last === '}') || (first === '[' && last === ']');
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function positionOverlay(el: TextLikeElement, setPos: (p: { x: number; y: number }) => void): void {
  const rect = getCaretRect(el);
  setPos({ x: rect.left, y: rect.bottom + 4 });
}

interface OverlayState {
  visible: boolean;
  text: string;
  pos: { x: number; y: number };
  notice: string | undefined;
  loading: boolean;
  pending: boolean;
  choices: string[];
  selected: number;
}

interface OverlaySetters {
  setVisible: Dispatch<SetStateAction<boolean>>;
  setText: Dispatch<SetStateAction<string>>;
  setPos: Dispatch<SetStateAction<{ x: number; y: number }>>;
  setNotice: Dispatch<SetStateAction<string | undefined>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setPending: Dispatch<SetStateAction<boolean>>;
  setChoices: Dispatch<SetStateAction<string[]>>;
  setSelected: Dispatch<SetStateAction<number>>;
}

function useOverlayState(): { state: OverlayState; setters: OverlaySetters } {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => subscribePending((count) => setPending(count > 0)), []);

  return {
    state: { visible, text, pos, notice, loading, pending, choices, selected },
    setters: {
      setVisible,
      setText,
      setPos,
      setNotice,
      setLoading,
      setPending,
      setChoices,
      setSelected,
    },
  };
}

function useDebouncedRequest(setters: OverlaySetters): DebouncedSend {
  const { setPos, setText, setVisible, setNotice, setLoading, setChoices, setSelected } = setters;
  return useMemo(
    () =>
      createSendRequest(
        setPos,
        setText,
        setVisible,
        setNotice,
        setLoading,
        setChoices,
        setSelected
      ),
    [setPos, setText, setVisible, setNotice, setLoading, setChoices, setSelected]
  );
}

function useKeyboardShortcuts(
  sendRequest: DebouncedSend,
  prefetch: () => void,
  visible: boolean,
  text: string,
  setVisible: Dispatch<SetStateAction<boolean>>,
  choicesLength: number,
  cycleSelection?: (direction: 1 | -1) => void
): void {
  useEffect((): (() => void) => {
    const onKeyUp = buildKeyUpHandler(prefetch, sendRequest, setVisible);
    const keyDownContext: KeyDownHandlerContext = {
      sendRequest,
      visible,
      text,
      setVisible,
      choicesLength,
    };
    if (cycleSelection) {
      keyDownContext.cycleSelection = cycleSelection;
    }
    const onKeyDown = buildKeyDownHandler(keyDownContext);

    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [sendRequest, prefetch, visible, text, setVisible, choicesLength, cycleSelection]);
}

function buildKeyUpHandler(
  prefetch: () => void,
  sendRequest: DebouncedSend,
  setVisible: Dispatch<SetStateAction<boolean>>
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent): void => {
    const active = getActiveTextInput();
    if (!active) return;
    if (shouldTriggerPrefetch(active, event.key)) prefetch();
    if (shouldTriggerCompletion(active, event.key)) sendRequest();
    if (event.key === 'Escape') setVisible(false);
  };
}

interface KeyDownHandlerContext {
  sendRequest: DebouncedSend;
  visible: boolean;
  text: string;
  setVisible: Dispatch<SetStateAction<boolean>>;
  choicesLength: number;
  cycleSelection?: (direction: 1 | -1) => void;
}

function buildKeyDownHandler(context: KeyDownHandlerContext): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent): void => {
    const active = getActiveTextInput();
    if (!active) return;
    if (maybeHandleSelectionCycle(event, context)) return;
    if (maybeHandleAccept(event, active, context)) return;
    if (event.key === 'Enter') {
      requestAnimationFrame(() => {
        context.sendRequest.flush();
      });
    }
  };
}

function maybeHandleSelectionCycle(event: KeyboardEvent, context: KeyDownHandlerContext): boolean {
  const { visible, choicesLength, cycleSelection } = context;
  if (!visible || !cycleSelection || choicesLength <= 1) return false;
  if (!event.altKey || event.ctrlKey || event.metaKey) return false;
  if (event.code === 'BracketRight' || event.code === 'BracketLeft') {
    cycleSelection(event.code === 'BracketRight' ? 1 : -1);
    event.preventDefault();
    return true;
  }
  return false;
}

function maybeHandleAccept(
  event: KeyboardEvent,
  active: TextLikeElement,
  context: KeyDownHandlerContext
): boolean {
  if (!context.visible || !isAcceptEvent(event, active)) return false;
  insertAtCaret(active, context.text);
  context.setVisible(false);
  context.sendRequest.flush();
  event.preventDefault();
  return true;
}

function useCompletionOverlay(): {
  state: OverlayState;
  actions: {
    accept: () => void;
    dismiss: () => void;
    select: (index: number) => void;
  };
} {
  const { state, setters } = useOverlayState();
  const sendRequest = useDebouncedRequest(setters);
  const prefetch = usePrefetch();
  const { actions, cycleSelection } = useOverlayActions(state, setters, sendRequest);

  useKeyboardShortcuts(
    sendRequest,
    prefetch,
    state.visible,
    state.text,
    setters.setVisible,
    state.choices.length,
    cycleSelection
  );

  return { state, actions };
}

interface OverlayActionsResult {
  actions: {
    accept: () => void;
    dismiss: () => void;
    select: (index: number) => void;
  };
  cycleSelection?: (direction: 1 | -1) => void;
}

function useOverlayActions(
  state: OverlayState,
  setters: OverlaySetters,
  sendRequest: DebouncedSend
): OverlayActionsResult {
  const { setVisible, setText, setSelected } = setters;

  const cycleSelection = useCallback(
    (direction: 1 | -1) => {
      setSelected((prev) => {
        const total = state.choices.length;
        if (total <= 1) return prev;
        const nextIndex = (prev + direction + total) % total;
        setText(state.choices[nextIndex] ?? '');
        return nextIndex;
      });
    },
    [setSelected, setText, state.choices]
  );

  const accept = useCallback(() => {
    const el = getActiveTextInput();
    if (el) insertAtCaret(el, state.text);
    setVisible(false);
    sendRequest.flush();
  }, [state.text, setVisible, sendRequest]);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  const select = useCallback(
    (index: number) => {
      setSelected(index);
      setText(state.choices[index] ?? '');
    },
    [setSelected, setText, state.choices]
  );

  const result: OverlayActionsResult = {
    actions: { accept, dismiss, select },
  };
  if (state.choices.length > 1) {
    result.cycleSelection = cycleSelection;
  }
  return result;
}

function App(): ReactElement {
  useAIWarmup();
  const {
    state: { visible, text, pos, notice, loading, pending, choices, selected },
    actions: { accept, dismiss, select },
  } = useCompletionOverlay();

  return (
    <SuggestionOverlay
      text={text}
      x={pos.x}
      y={pos.y}
      onAccept={accept}
      onDismiss={dismiss}
      visible={visible}
      notice={notice}
      loading={loading}
      pending={pending}
      suggestions={choices}
      selectedIndex={selected}
      onSelect={select}
      acceptLabel={computeAcceptLabel()}
    />
  );
}

function usePrefetch(): () => void {
  return useMemo(() => createPrefetchRequest(), []);
}

function useAIWarmup(): void {
  useEffect(() => {
    const scope = deriveSessionScope({ url: location.href, pageTitle: document.title });
    const message: AppMessage<WarmupRequestPayload> = {
      type: 'AI_WARMUP_REQUEST',
      payload: { phase: 'availability', scope },
      correlationId: Math.random().toString(36).slice(2),
    };
    void chrome.runtime.sendMessage(message).catch(() => {
      // ignore warmup errors silently
    });
  }, []);
}

function shouldTriggerPrefetch(el: TextLikeElement, key: string): boolean {
  const { text, caret } = getTextAndCaret(el);
  const before = text.slice(0, caret);
  return shouldPrefetchForKey(key, before);
}

function insertAtCaret(el: TextLikeElement, insertText: string): void {
  if (el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const normalizedInsert = trimSuggestionOverlap(before, insertText);
    if (!normalizedInsert) return;
    const nextValue = `${before}${normalizedInsert}${after}`;
    const nextCaret = before.length + normalizedInsert.length;
    el.value = nextValue;
    el.setSelectionRange(nextCaret, nextCaret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  // contenteditable host
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return;
  const beforeRange = range.cloneRange();
  beforeRange.selectNodeContents(el);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  const beforeText = beforeRange.toString();
  const normalizedInsert = trimSuggestionOverlap(beforeText, insertText);
  if (!normalizedInsert) return;
  range.deleteContents();
  const textNode = document.createTextNode(normalizedInsert);
  range.insertNode(textNode);
  // move caret after inserted
  range.setStartAfter(textNode);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function providerLabel(resolved: 'chrome-ai' | 'openai' | 'fallback'): string {
  if (resolved === 'openai') return 'Cloud (OpenAI — sent externally)';
  if (resolved === 'chrome-ai') return 'On-device';
  return 'Local fallback';
}

function shouldTriggerCompletion(el: TextLikeElement, key: string): boolean {
  let reason: string | null = null;
  // Trigger on space, Enter, or common punctuation.
  if (key === ' ' || key === 'Enter' || isPunctuation(key)) {
    reason = 'punctuation';
  } else if (key.length === 1 && !/\s/u.test(key)) {
    const tokenLen = currentTokenLength(el);
    if (tokenLen >= 2) {
      reason = `token-length>=2 (${tokenLen})`;
    }
  }

  if (!reason) return false;
  return isCaretAtLineEnd(el);
}

function isPunctuation(ch: string): boolean {
  return /[.,!?;:、。！？””’）（()\[\]…]/u.test(ch);
}

function currentTokenLength(el: TextLikeElement): number {
  const { text, caret } = getTextAndCaret(el);
  const before = text.slice(0, caret);
  const parts = before.split(/[\s.,!?;:、。！？」」’）（()\[\]…]+/u);
  const last = parts[parts.length - 1] ?? '';
  return last.length;
}

function isMac(): boolean {
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isNotionHost(): boolean {
  try {
    const host = new URL(location.href).hostname;
    return host.endsWith('notion.so') || host.endsWith('notion.site');
  } catch {
    return false;
  }
}

function isAcceptEvent(event: KeyboardEvent, active: TextLikeElement | null): boolean {
  if (!active) return false;
  if (isNotionHost()) return isNotionAcceptEvent(event);
  if (active instanceof HTMLTextAreaElement) return isTextareaAcceptEvent(event);
  return isContentEditableAcceptEvent(event);
}

function isNotionAcceptEvent(event: KeyboardEvent): boolean {
  if (event.key !== 'Enter' || !event.shiftKey) return false;
  return isMac() ? isMacAcceptCombo(event) : isWindowsAcceptCombo(event);
}

function isTextareaAcceptEvent(event: KeyboardEvent): boolean {
  return event.key === 'Tab';
}

function isContentEditableAcceptEvent(event: KeyboardEvent): boolean {
  if (event.key !== 'Enter' || !event.shiftKey) return false;
  return isMac() ? isMacAcceptCombo(event) : isWindowsAcceptCombo(event);
}

function isMacAcceptCombo(event: KeyboardEvent): boolean {
  return event.metaKey && !event.ctrlKey && !event.altKey;
}

function isWindowsAcceptCombo(event: KeyboardEvent): boolean {
  return event.ctrlKey && !event.altKey && !event.metaKey;
}

function computeAcceptLabel(): string {
  if (isNotionHost()) return isMac() ? 'Cmd+Shift+Enter' : 'Ctrl+Shift+Enter';
  const active = getActiveTextInput();
  if (active instanceof HTMLTextAreaElement || !active) return 'Tab';
  return isMac() ? 'Cmd+Shift+Enter' : 'Ctrl+Shift+Enter';
}

// Mount within Shadow DOM to isolate styles from the page
((): void => {
  const hostId = 'ai-react-overlay-host';
  let host = document.getElementById(hostId);
  if (!host) {
    const newHost = document.createElement('div');
    newHost.id = hostId;
    document.documentElement.appendChild(newHost);
    host = newHost;
  }
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  // Inject content stylesheet into shadow root only
  const styleId = 'ai-content-tailwind';
  if (!shadow.getElementById(styleId)) {
    const link = document.createElement('link');
    link.id = styleId;
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('assets/style.css');
    shadow.appendChild(link);
  }
  // Create root for React app inside shadow
  let appRoot = shadow.getElementById('ai-react-overlay-root');
  if (!appRoot) {
    appRoot = document.createElement('div');
    appRoot.id = 'ai-react-overlay-root';
    shadow.appendChild(appRoot);
  }
  const root = createRoot(appRoot);
  root.render(<App />);
})();
const COMPLETION_DEBOUNCE_MS = 200;
