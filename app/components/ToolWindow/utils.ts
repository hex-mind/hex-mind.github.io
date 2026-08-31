export function formatGlobToolTitle(
  input: Record<string, unknown> | undefined,
): string | undefined {
  const pattern = typeof input?.pattern === 'string' ? input.pattern.trim() : '';
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  const include = typeof input?.include === 'string' ? input.include.trim() : '';
  const segments: string[] = [];
  if (pattern) segments.push(pattern);
  if (path) segments.push(`@ ${path}`);
  if (include) segments.push(`include ${include}`);
  const title = segments.join(' ');
  return title || undefined;
}

export function resolveReadWritePath(
  input: Record<string, unknown> | undefined,
  metadata: Record<string, unknown> | undefined,
  state: Record<string, unknown> | undefined,
): string | undefined {
  const filePath = typeof input?.filePath === 'string' ? input.filePath.trim() : '';
  if (filePath) return filePath;
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  if (path) return path;
  const metadataPath = typeof metadata?.filepath === 'string' ? metadata.filepath.trim() : '';
  if (metadataPath) return metadataPath;
  const title = typeof state?.title === 'string' ? state.title.trim() : '';
  return title || undefined;
}

export function resolveReadRange(input: Record<string, unknown> | undefined): {
  offset?: number;
  limit?: number;
} {
  const offsetValue = input?.offset;
  const limitValue = input?.limit;
  const offset =
    typeof offsetValue === 'number' && Number.isFinite(offsetValue) && offsetValue >= 0
      ? Math.floor(offsetValue)
      : undefined;
  const limit =
    typeof limitValue === 'number' && Number.isFinite(limitValue) && limitValue > 0
      ? Math.floor(limitValue)
      : undefined;
  return { offset, limit };
}

export function formatListToolTitle(
  input: Record<string, unknown> | undefined,
): string | undefined {
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  return path || undefined;
}

export function formatWebfetchToolTitle(
  input: Record<string, unknown> | undefined,
): string | undefined {
  const url = typeof input?.url === 'string' ? input.url.trim() : '';
  return url || undefined;
}

export function formatQueryToolTitle(
  input: Record<string, unknown> | undefined,
): string | undefined {
  const query = typeof input?.query === 'string' ? input.query.trim() : '';
  return query || undefined;
}

export function formatToolValue(value: unknown) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function parseToolOutputText(output: unknown) {
  if (output === undefined) return undefined;
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object') {
    const outputRecord = output as Record<string, unknown>;
    const outputContent =
      (outputRecord.content as string | undefined) ??
      (outputRecord.text as string | undefined) ??
      (outputRecord.body as string | undefined) ??
      (outputRecord.result as string | undefined);
    if (typeof outputContent === 'string') return outputContent;
    const stdout = outputRecord.stdout;
    const stderr = outputRecord.stderr;
    const parts: string[] = [];
    if (typeof stdout === 'string' && stdout.length > 0) parts.push(stdout);
    if (typeof stderr === 'string' && stderr.length > 0) parts.push(stderr);
    if (parts.length > 0) return parts.join('\n');
  }
  return formatToolValue(output);
}

export function formatTaskToolOutput(value: string) {
  return value
    .split('\n')
    .filter((line) => !/^task_id:\s*/i.test(line.trim()))
    .join('\n')
    .replace(/<\/?task_result>/gi, '')
    .trim();
}

const TOOL_WINDOW_HIDDEN = new Set([
  'question',
  'todoread',
  'todowrite',
  'lsp',
  'plan_enter',
  'plan_exit',
  'task',
]);
const TOOL_WINDOW_SUPPORTED = new Set([
  'apply_patch',
  'bash',
  'codesearch',
  'edit',
  'glob',
  'grep',
  'list',
  'multiedit',
  'read',
  'task',
  'webfetch',
  'websearch',
  'write',
]);

export function shouldRenderToolWindow(tool: string) {
  return !TOOL_WINDOW_HIDDEN.has(tool) && TOOL_WINDOW_SUPPORTED.has(tool);
}

/** One accent per window role, sampled from the HEX logo. */
export const WINDOW_COLOR = {
  cyan: '#5ecbf5',
  blue: '#4b7cec',
  purple: '#6c32f3',
  magenta: '#9622f5',
} as const;

export function toolColor(tool: string): string {
  switch (tool) {
    case 'grep':
    case 'glob':
    case 'webfetch':
    case 'websearch':
    case 'codesearch':
    case 'read':
    case 'list':
      return WINDOW_COLOR.cyan;
    case 'bash':
    case 'question':
      return WINDOW_COLOR.blue;
    case 'task':
    case 'batch':
      return WINDOW_COLOR.purple;
    case 'edit':
    case 'multiedit':
    case 'apply_patch':
    case 'write':
      return WINDOW_COLOR.magenta;
    default:
      return WINDOW_COLOR.blue;
  }
}

export function guessLanguageFromPath(path?: string): string {
  if (!path) return 'text';
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'tsx';
    case 'js':
      return 'javascript';
    case 'jsx':
      return 'jsx';
    case 'vue':
      return 'vue';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'scss':
      return 'scss';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'diff':
    case 'patch':
      return 'diff';
    case 'sh':
      return 'shellscript';
    case 'py':
      return 'python';
    case 'java':
      return 'java';
    case 'php':
      return 'php';
    case 'sql':
      return 'sql';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'rb':
      return 'ruby';
    case 'toml':
      return 'toml';
    case 'svg':
    case 'xml':
      return 'xml';
    case 'c':
      return 'c';
    case 'cpp':
    case 'cc':
    case 'cxx':
      return 'cpp';
    case 'h':
    case 'hpp':
      return 'cpp';
    default:
      return 'text';
  }
}
