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
import { debounce } from '../utils/debounce';
import { getActiveTextInput, type TextLikeElement } from './text-detector';
import type {
  AppMessage,
  CompletionRequestPayload,
  CompletionResponsePayload,
} from '../types/completion.d';

function isCompletionResponsePayload(value: unknown): value is CompletionResponsePayload {
  return !!value && typeof value === 'object' && 'suggestions' in value;
}

function getTextAndCaret(el: TextLikeElement): { text: string; caret: number } {
  if (el instanceof HTMLTextAreaElement) {
    const caret = el.selectionStart ?? el.value.length;
    return { text: el.value, caret };
  }
  // contenteditable host
  const host = el;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0)
    return { text: host.innerText ?? host.textContent ?? '', caret: 0 };
  const range = sel.getRangeAt(0);
  if (!host.contains(range.endContainer))
    return { text: host.innerText ?? host.textContent ?? '', caret: 0 };
  const full = document.createRange();
  full.selectNodeContents(host);
  const allText = full.toString();
  const pre = range.cloneRange();
  pre.selectNodeContents(host);
  pre.setEnd(range.endContainer, range.endOffset);
  const caret = pre.toString().length;
  return { text: allText, caret };
}

function getCaretRect(el: TextLikeElement): DOMRectReadOnly {
  if (el instanceof HTMLTextAreaElement) return el.getBoundingClientRect();
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (el.contains(range.endContainer)) {
      const rects = range.getClientRects();
      const last = rects.item(rects.length - 1);
      if (last) return last;
    }
  }
  return el.getBoundingClientRect();
}

function buildMessage(el: TextLikeElement): AppMessage<CompletionRequestPayload> {
  const { text, caret } = getTextAndCaret(el);
  const contextText = document.body?.innerText?.slice(0, 1000) ?? '';
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

function createSendRequest(
  setPos: (p: { x: number; y: number }) => void,
  setText: (t: string) => void,
  setVisible: (v: boolean) => void,
  setNotice: (n: string | undefined) => void,
  setLoading?: (b: boolean) => void,
  setChoices?: (arr: string[]) => void,
  setSelected?: (i: number) => void
): () => void {
  const fn = async (): Promise<void> => {
    const el = getActiveTextInput();
    if (!el) return;
    if (setLoading) {
      resetOverlayBeforeRequest(setLoading, setText, setChoices, setSelected, setNotice);
    }
    const message = buildMessage(el);
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
    }
  };
  return debounce(fn, 200);
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
  const suggestions = extractSuggestions(payload);
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
  return (payload?.suggestions ?? [])
    .map((s) => (typeof s.text === 'string' ? s.text : String(s)))
    .slice(0, 3);
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
  choices: string[];
  selected: number;
}

interface OverlaySetters {
  setVisible: Dispatch<SetStateAction<boolean>>;
  setText: Dispatch<SetStateAction<string>>;
  setPos: Dispatch<SetStateAction<{ x: number; y: number }>>;
  setNotice: Dispatch<SetStateAction<string | undefined>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setChoices: Dispatch<SetStateAction<string[]>>;
  setSelected: Dispatch<SetStateAction<number>>;
}

function useOverlayState(): { state: OverlayState; setters: OverlaySetters } {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);

  return {
    state: { visible, text, pos, notice, loading, choices, selected },
    setters: { setVisible, setText, setPos, setNotice, setLoading, setChoices, setSelected },
  };
}

function useDebouncedRequest(setters: OverlaySetters): () => void {
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
  sendRequest: () => void,
  visible: boolean,
  text: string,
  setVisible: Dispatch<SetStateAction<boolean>>
): void {
  useEffect((): (() => void) => {
    const onKeyUp = (e: KeyboardEvent): void => {
      const active = getActiveTextInput();
      if (!active) return;
      if (shouldTriggerCompletion(active, e.key)) sendRequest();
      if (e.key === 'Escape') setVisible(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isAcceptEvent(e) && visible) {
        const active = getActiveTextInput();
        if (active) {
          insertAtCaret(active, text);
          setVisible(false);
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [sendRequest, visible, text, setVisible]);
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
  const { setVisible, setText, setSelected } = setters;
  const sendRequest = useDebouncedRequest(setters);
  useKeyboardShortcuts(sendRequest, state.visible, state.text, setVisible);

  const accept = useCallback(() => {
    const el = getActiveTextInput();
    if (el) insertAtCaret(el, state.text);
    setVisible(false);
  }, [state.text, setVisible]);

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

  return {
    state,
    actions: {
      accept,
      dismiss,
      select,
    },
  };
}

function App(): ReactElement {
  const {
    state: { visible, text, pos, notice, loading, choices, selected },
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
      suggestions={choices}
      selectedIndex={selected}
      onSelect={select}
      acceptLabel={computeAcceptLabel()}
    />
  );
}

function insertAtCaret(el: TextLikeElement, insertText: string): void {
  if (el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const nextValue = `${before}${insertText}${after}`;
    const nextCaret = before.length + insertText.length;
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
  range.deleteContents();
  const textNode = document.createTextNode(insertText);
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
  // Trigger on space, Enter, or common punctuation.
  if (key === ' ' || key === 'Enter' || isPunctuation(key)) return true;
  // Trigger on character keys only when token length is sufficient.
  if (key.length === 1 && !/\s/u.test(key)) {
    const tokenLen = currentTokenLength(el);
    return tokenLen >= 3; // minimal token length threshold
  }
  return false;
}

function isPunctuation(ch: string): boolean {
  return /[.,!?;:、。！？””’）（()\[\]…]/u.test(ch);
}

function currentTokenLength(el: TextLikeElement): number {
  if (el instanceof HTMLTextAreaElement) {
    const caret = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, caret);
    const parts = before.split(/[\s.,!?;:、。！？」」’）（()\[\]…]+/u);
    const last = parts[parts.length - 1] ?? '';
    return last.length;
  }
  const host = el;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!host.contains(range.endContainer)) return 0;
  const pre = range.cloneRange();
  pre.selectNodeContents(host);
  pre.setEnd(range.endContainer, range.endOffset);
  const before = pre.toString();
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

function isAcceptEvent(e: KeyboardEvent): boolean {
  if (isNotionHost()) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) return true;
    return false;
  }
  return e.key === 'Tab';
}

function computeAcceptLabel(): string {
  if (isNotionHost()) return isMac() ? 'Cmd+Enter' : 'Ctrl+Enter';
  return 'Tab';
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
