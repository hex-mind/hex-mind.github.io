import katex from 'katex';
import type MarkdownIt from 'markdown-it';

const KATEX_OPTIONS = {
  throwOnError: false,
  output: 'html',
  strict: 'ignore',
  trust: false,
} as const;

function isEscaped(src: string, index: number) {
  let count = 0;
  for (let i = index - 1; i >= 0 && src[i] === '\\'; i--) count++;
  return count % 2 === 1;
}

function findUnescaped(src: string, from: number, delim: string, max: number) {
  const n = delim.length;
  for (let i = from; i + n <= max; i++) {
    if (src.startsWith(delim, i) && !isEscaped(src, i)) return i;
  }
  return -1;
}

function isSpaceChar(ch: string | undefined) {
  return ch === ' ' || ch === '\t' || ch === '\n';
}

function findClosingDollar(src: string, from: number, max: number) {
  for (let i = from; i < max; i++) {
    if (src[i] !== '$') continue;
    if (isEscaped(src, i)) continue;
    if (src[i + 1] === '$') {
      i++;
      continue;
    }
    if (i > from && isSpaceChar(src[i - 1])) continue;
    return i;
  }
  return -1;
}

/**
 * ponytail: `$100` / `$HOME` stay text. `$F$` and `$x$` still render.
 * Upgrade: a real currency/env tokenizer if this collides.
 */
export function isLikelyInlineMath(content: string) {
  if (!content || content.includes('\n')) return false;
  if (/^\d+([.,]\d+)*$/.test(content)) return false;
  if (content.length >= 3 && /^[A-Z][A-Z0-9_]*$/.test(content)) return false;
  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderKatex(tex: string, displayMode: boolean) {
  try {
    return katex.renderToString(tex, { ...KATEX_OPTIONS, displayMode });
  } catch {
    const escaped = escapeHtml(tex);
    return displayMode
      ? `<pre class="katex-error">${escaped}</pre>`
      : `<code class="katex-error">${escaped}</code>`;
  }
}

function pushInlineMath(
  state: {
    push: (type: string, tag: string, nesting: 0) => {
      content: string;
      markup: string;
      meta: { display?: boolean } | null;
    };
  },
  content: string,
  markup: string,
  display: boolean,
) {
  const token = state.push('math_inline', 'span', 0);
  token.content = content;
  token.markup = markup;
  token.meta = display ? { display: true } : null;
}

function mathInline(
  state: {
    src: string;
    pos: number;
    posMax: number;
    push: (type: string, tag: string, nesting: 0) => {
      content: string;
      markup: string;
      meta: { display?: boolean } | null;
    };
  },
  silent: boolean,
) {
  const src = state.src;
  const pos = state.pos;
  const max = state.posMax;
  if (pos >= max) return false;

  if (src.startsWith('$$', pos)) {
    const close = findUnescaped(src, pos + 2, '$$', max);
    if (close < 0) return false;
    if (!silent) pushInlineMath(state, src.slice(pos + 2, close).trim(), '$$', true);
    state.pos = close + 2;
    return true;
  }

  if (src.startsWith('\\[', pos)) {
    const close = findUnescaped(src, pos + 2, '\\]', max);
    if (close < 0) return false;
    if (!silent) pushInlineMath(state, src.slice(pos + 2, close).trim(), '\\[\\]', true);
    state.pos = close + 2;
    return true;
  }

  if (src.startsWith('\\(', pos)) {
    const close = findUnescaped(src, pos + 2, '\\)', max);
    if (close < 0) return false;
    if (!silent) pushInlineMath(state, src.slice(pos + 2, close).trim(), '\\(\\)', false);
    state.pos = close + 2;
    return true;
  }

  if (src[pos] !== '$') return false;
  const next = src[pos + 1];
  if (next === undefined || isSpaceChar(next)) return false;

  const close = findClosingDollar(src, pos + 1, max);
  if (close < 0) return false;
  const content = src.slice(pos + 1, close);
  if (!isLikelyInlineMath(content)) return false;
  if (!silent) pushInlineMath(state, content, '$', false);
  state.pos = close + 1;
  return true;
}

function mathBlock(
  state: {
    src: string;
    bMarks: number[];
    eMarks: number[];
    tShift: number[];
    blkIndent: number;
    line: number;
    push: (type: string, tag: string, nesting: 0) => {
      content: string;
      markup: string;
      block: boolean;
      map: [number, number] | null;
    };
  },
  start: number,
  end: number,
  silent: boolean,
) {
  const src = state.src;
  const startPos = state.bMarks[start] + state.tShift[start];
  const firstEnd = state.eMarks[start];

  let open: '$$' | '\\[' | null = null;
  if (src.startsWith('$$', startPos)) open = '$$';
  else if (src.startsWith('\\[', startPos)) open = '\\[';
  if (!open) return false;

  const openLen = 2;
  const closeDelim = open === '$$' ? '$$' : '\\]';

  const sameLineClose = findUnescaped(src, startPos + openLen, closeDelim, firstEnd);
  if (sameLineClose >= 0) {
    if (src.slice(sameLineClose + closeDelim.length, firstEnd).trim() !== '') return false;
    if (silent) return true;
    const token = state.push('math_block', 'div', 0);
    token.block = true;
    token.markup = open;
    token.content = src.slice(startPos + openLen, sameLineClose).trim();
    token.map = [start, start + 1];
    state.line = start + 1;
    return true;
  }

  for (let next = start + 1; next < end; next++) {
    const pos = state.bMarks[next] + state.tShift[next];
    const lineEnd = state.eMarks[next];
    if (pos < lineEnd && state.tShift[next] < state.blkIndent) break;
    const close = findUnescaped(src, pos, closeDelim, lineEnd);
    if (close < 0) continue;
    if (src.slice(close + closeDelim.length, lineEnd).trim() !== '') continue;
    if (silent) return true;
    const token = state.push('math_block', 'div', 0);
    token.block = true;
    token.markup = open;
    token.content = src.slice(startPos + openLen, close).trim();
    token.map = [start, next + 1];
    state.line = next + 1;
    return true;
  }

  return false;
}

export function markdownKatexPlugin(md: MarkdownIt) {
  md.inline.ruler.before('escape', 'math_inline', mathInline);
  md.block.ruler.after('blockquote', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
  md.renderer.rules.math_inline = (tokens, idx) => {
    const token = tokens[idx];
    return renderKatex(token.content, Boolean(token.meta?.display));
  };
  md.renderer.rules.math_block = (tokens, idx) => `${renderKatex(tokens[idx].content, true)}\n`;
}
