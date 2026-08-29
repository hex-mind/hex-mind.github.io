export type SessionSearchKind = 'user' | 'assistant' | 'tool';

export type SessionSearchSource = {
  threadId: string;
  messageId: string;
  kind: SessionSearchKind;
  label: string;
  text: string;
  time?: number;
};

export type SessionSearchHit = {
  id: string;
  threadId: string;
  messageId: string;
  kind: SessionSearchKind;
  label: string;
  snippet: string;
  time?: number;
};

export type HighlightPart = {
  text: string;
  hit: boolean;
};

const SNIPPET_RADIUS = 42;
const MAX_HITS = 80;

export function snippetAround(text: string, index: number, queryLength: number): string {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + queryLength + SNIPPET_RADIUS);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
}

export function splitHighlight(snippet: string, query: string): HighlightPart[] {
  const needle = query.trim();
  if (!needle || !snippet) return [{ text: snippet, hit: false }];
  const haystack = snippet.toLocaleLowerCase();
  const needleLower = needle.toLocaleLowerCase();
  const parts: HighlightPart[] = [];
  let from = 0;
  while (from < snippet.length) {
    const at = haystack.indexOf(needleLower, from);
    if (at < 0) {
      parts.push({ text: snippet.slice(from), hit: false });
      break;
    }
    if (at > from) parts.push({ text: snippet.slice(from, at), hit: false });
    parts.push({ text: snippet.slice(at, at + needle.length), hit: true });
    from = at + needle.length;
  }
  return parts.filter((part) => part.text.length > 0);
}

export function searchSessionSources(
  sources: SessionSearchSource[],
  query: string,
  limit = MAX_HITS,
): SessionSearchHit[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const hits: SessionSearchHit[] = [];
  for (const source of sources) {
    const haystack = source.text.toLocaleLowerCase();
    const at = haystack.indexOf(needle);
    if (at < 0) continue;
    hits.push({
      id: `${source.threadId}:${source.messageId}:${source.kind}:${at}`,
      threadId: source.threadId,
      messageId: source.messageId,
      kind: source.kind,
      label: source.label,
      snippet: snippetAround(source.text, at, needle.length),
      time: source.time,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

export function toolSearchText(
  tool: string,
  state: {
    title?: string;
    input?: Record<string, unknown>;
    status?: string;
    error?: string;
  },
): string {
  const chunks = [tool];
  if (typeof state.title === 'string' && state.title.trim()) chunks.push(state.title);
  const input = state.input ?? {};
  for (const key of ['filePath', 'path', 'command', 'pattern', 'query', 'url', 'description']) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) chunks.push(value);
  }
  if (state.status === 'error' && typeof state.error === 'string' && state.error.trim()) {
    chunks.push(state.error);
  }
  return chunks.join('\n');
}
