import { splitFileContentDirectoryAndPath } from './path';

type QueryValue = string | number | boolean | undefined;

type JsonBody = Record<string, unknown> | Array<unknown>;
type RequestOptions = {
  instanceDirectory?: string;
  signal?: AbortSignal;
};
type LocalNetworkRequestInit = RequestInit & {
  targetAddressSpace?: 'loopback';
};

let configuredBaseUrl = '';
let configuredAuthorization: string | undefined;

export function setBaseUrl(baseUrl: string) {
  configuredBaseUrl = baseUrl.replace(/\/+$/, '');
}

export function setAuthorization(authorization: string | undefined) {
  configuredAuthorization = authorization;
}

function getBaseUrlOrThrow() {
  if (!configuredBaseUrl) {
    throw new Error('OpenCode base URL is not configured.');
  }
  return configuredBaseUrl;
}

function buildQuery(params?: Record<string, QueryValue>) {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function createUrl(path: string, params?: Record<string, QueryValue>) {
  return `${getBaseUrlOrThrow()}${path}${buildQuery(params)}`;
}

function createRequestInit(init: RequestInit): LocalNetworkRequestInit {
  try {
    const hostname = new URL(getBaseUrlOrThrow()).hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return { ...init, targetAddressSpace: 'loopback' };
    }
  } catch {
    // Let fetch report malformed URLs with its native error.
  }
  return init;
}

async function parseJson(response: Response) {
  if (response.status === 204 || response.status === 205) return null;
  if (response.headers.get('content-length') === '0') return null;

  const raw = await response.text();
  if (!raw.trim()) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function buildHeaders(options?: RequestOptions, contentType?: string) {
  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = contentType;
  if (options?.instanceDirectory) headers['x-opencode-directory'] = options.instanceDirectory;
  if (configuredAuthorization) headers['Authorization'] = configuredAuthorization;
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function formatHttpError(path: string, status: number, body: unknown) {
  const record =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const data =
    record?.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : null;
  const detail =
    (typeof data?.message === 'string' && data.message.trim()) ||
    (typeof record?.message === 'string' && record.message.trim()) ||
    (typeof body === 'string' && body.trim()) ||
    '';
  return detail
    ? `${path} request failed (${status}): ${detail}`
    : `${path} request failed (${status})`;
}

async function getJson(
  path: string,
  params?: Record<string, QueryValue>,
  options?: RequestOptions,
) {
  const response = await fetch(
    createUrl(path, params),
    createRequestInit({
      headers: buildHeaders(options),
      signal: options?.signal,
    }),
  );
  const body = await parseJson(response);
  if (!response.ok) throw new Error(formatHttpError(path, response.status, body));
  return body;
}

async function sendJson(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  options: { params?: Record<string, QueryValue>; body?: JsonBody; request?: RequestOptions },
) {
  const response = await fetch(
    createUrl(path, options.params),
    createRequestInit({
      method,
      headers: buildHeaders(options.request, 'application/json'),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  );
  const parsed = await parseJson(response);
  if (!response.ok) throw new Error(formatHttpError(path, response.status, parsed));
  return parsed;
}

export function createWsUrl(
  path: string,
  params?: Record<string, QueryValue>,
  credentials?: { username: string; password: string },
) {
  const wsBase = getBaseUrlOrThrow().replace(/^http/, 'ws');
  const url = `${wsBase}${path}${buildQuery(params)}`;

  if (!credentials) return url;

  const urlObj = new URL(url);
  if (credentials.username || credentials.password) {
    urlObj.username = credentials.username;
    urlObj.password = credentials.password;
  }
  return urlObj.toString();
}

export function getPathInfo(options?: RequestOptions) {
  return getJson('/path', undefined, options) as Promise<Record<string, string>>;
}

export function listFiles(payload: { directory: string; path?: string }, options?: RequestOptions) {
  return getJson(
    '/file',
    {
      directory: payload.directory,
      path: payload.path,
    },
    options,
  ) as Promise<unknown>;
}

/** OpenCode `/file` returns 500 (not 404) when the path does not exist. */
export function isMissingPathError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /\/file request failed \(500\)/i.test(message) || /\/file request failed \(404\)/.test(message)
  );
}

export function formatDirectoryListError(error: unknown): string {
  if (isMissingPathError(error)) return 'Directory not found.';
  return error instanceof Error ? error.message : String(error);
}

/** List an absolute directory via home (or `/`) so missing guesses do not spawn instances. */
export function listFilesAt(
  absoluteDirectory: string,
  homePath?: string,
  options?: RequestOptions,
) {
  const home = homePath?.replace(/\/+$/, '') || null;
  const { directory, path } = splitFileContentDirectoryAndPath(absoluteDirectory, home);
  return listFiles({ directory, path }, options);
}

export function findFiles(
  payload: {
    directory?: string;
    query: string;
    type?: 'file' | 'directory';
    dirs?: boolean;
    limit?: number;
  },
  options?: RequestOptions,
) {
  return getJson(
    '/find/file',
    {
      directory: payload.directory,
      query: payload.query,
      type: payload.type,
      dirs: payload.dirs === false ? 'false' : payload.dirs === true ? 'true' : undefined,
      limit: payload.limit,
    },
    options,
  ) as Promise<unknown>;
}

export function readFileContent(
  payload: { directory: string; path: string },
  options?: RequestOptions,
) {
  return getJson(
    '/file/content',
    {
      directory: payload.directory,
      path: payload.path,
    },
    options,
  ) as Promise<unknown>;
}

export function listProjects(directory?: string) {
  return getJson('/project', { directory }) as Promise<unknown>;
}

export function getCurrentProject(directory?: string) {
  return getJson('/project/current', { directory }) as Promise<unknown>;
}

export function listSessions(
  options: {
    directory?: string;
    roots?: boolean;
    search?: string;
    limit?: number;
    instanceDirectory?: string;
  } = {},
) {
  return getJson(
    '/session',
    {
      directory: options.directory,
      roots: options.roots ? 'true' : undefined,
      search: options.search,
      limit: options.limit,
    },
    {
      instanceDirectory: options.instanceDirectory,
    },
  ) as Promise<unknown>;
}

export function getSession(sessionId: string, directory?: string, request?: RequestOptions) {
  return getJson(`/session/${sessionId}`, { directory }, request) as Promise<unknown>;
}

export function getVcsInfo(directory: string) {
  return getJson('/vcs', { directory }) as Promise<unknown>;
}

export function deleteWorktree(directory: string, targetDirectory: string) {
  return sendJson('/experimental/worktree', 'DELETE', {
    params: { directory },
    body: { directory: targetDirectory },
  }) as Promise<unknown>;
}

export function createSession(directory?: string) {
  return sendJson('/session', 'POST', {
    params: { directory },
    body: {},
  }) as Promise<unknown>;
}

export async function deleteSession(
  sessionId: string,
  directory?: string,
  request?: RequestOptions,
) {
  return sendJson(`/session/${sessionId}`, 'DELETE', {
    params: { directory },
    request,
  });
}

export function updateSession(
  sessionId: string,
  payload: { title?: string; time?: { archived?: number } },
  directory?: string,
) {
  return sendJson(`/session/${sessionId}`, 'PATCH', {
    params: { directory },
    body: payload,
  }) as Promise<unknown>;
}

export function revertSession(sessionId: string, messageId: string, directory?: string) {
  return sendJson(`/session/${sessionId}/revert`, 'POST', {
    params: { directory },
    body: { messageID: messageId },
  }) as Promise<unknown>;
}

export function unrevertSession(sessionId: string, directory?: string) {
  return sendJson(`/session/${sessionId}/unrevert`, 'POST', {
    params: { directory },
    body: {},
  }) as Promise<unknown>;
}

export function listProviders() {
  return getJson('/config/providers') as Promise<unknown>;
}

export function listAgents() {
  return getJson('/agent') as Promise<unknown>;
}

export function listCommands(directory?: string) {
  return getJson('/command', { directory }) as Promise<unknown>;
}

export function getSessionStatusMap(directory?: string, request?: RequestOptions) {
  return getJson('/session/status', { directory }, request) as Promise<unknown>;
}

export function listPendingPermissions(directory?: string) {
  return getJson('/permission', { directory }) as Promise<unknown>;
}

export function listPendingQuestions(directory?: string) {
  return getJson('/question', { directory }) as Promise<unknown>;
}

export function listSessionMessages(
  sessionId: string,
  options: { directory?: string; limit?: number } = {},
) {
  return getJson(`/session/${sessionId}/message`, {
    directory: options.directory,
    limit: options.limit,
  }) as Promise<unknown>;
}

export function getSessionTodos(sessionId: string, directory?: string) {
  return getJson(`/session/${sessionId}/todo`, { directory }) as Promise<unknown>;
}

export function listPtys(directory?: string) {
  return getJson('/pty', { directory }) as Promise<unknown>;
}

export function createPty(payload: {
  directory?: string;
  cwd?: string;
  command?: string;
  args?: string[];
  title?: string;
}) {
  return sendJson('/pty', 'POST', {
    params: { directory: payload.directory },
    body: {
      command: payload.command,
      args: payload.args,
      cwd: payload.cwd,
      title: payload.title,
    },
  }) as Promise<unknown>;
}

export function updatePtySize(
  ptyId: string,
  payload: { directory?: string; rows: number; cols: number },
) {
  return sendJson(`/pty/${ptyId}`, 'PUT', {
    params: { directory: payload.directory },
    body: { size: { rows: payload.rows, cols: payload.cols } },
  }) as Promise<unknown>;
}

export function deletePty(ptyId: string, directory?: string) {
  return sendJson(`/pty/${ptyId}`, 'DELETE', {
    params: { directory },
  }) as Promise<unknown>;
}

export async function sendCommand(
  sessionId: string,
  payload: {
    directory?: string;
    command: string;
    arguments: string;
    agent?: string;
    model?: string;
    variant?: string;
  },
) {
  await sendJson(`/session/${sessionId}/command`, 'POST', {
    params: { directory: payload.directory },
    body: payload,
  });
}

export async function sendPromptAsync(
  sessionId: string,
  payload: {
    directory: string;
    agent: string;
    model: { providerID?: string; modelID: string };
    variant?: string;
    parts: Array<Record<string, unknown>>;
  },
) {
  await sendJson(`/session/${sessionId}/prompt_async`, 'POST', {
    params: { directory: payload.directory },
    body: {
      agent: payload.agent,
      model: payload.model,
      variant: payload.variant,
      parts: payload.parts,
    },
  });
}

export async function abortSession(sessionId: string, directory?: string) {
  await sendJson(`/session/${sessionId}/abort`, 'POST', {
    params: { directory },
  });
}

export async function replyPermission(
  requestId: string,
  payload: { directory?: string; reply: string },
) {
  await sendJson(`/permission/${requestId}/reply`, 'POST', {
    params: { directory: payload.directory },
    body: { reply: payload.reply },
  });
}

export async function replyQuestion(
  requestId: string,
  payload: { directory?: string; answers: string[][] },
) {
  await sendJson(`/question/${requestId}/reply`, 'POST', {
    params: { directory: payload.directory },
    body: { answers: payload.answers },
  });
}

export async function rejectQuestion(requestId: string, directory?: string) {
  await sendJson(`/question/${requestId}/reject`, 'POST', {
    params: { directory },
  });
}
