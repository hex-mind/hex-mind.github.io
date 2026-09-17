export type GitStatusCode = '' | 'M' | 'A' | 'D' | 'R' | 'C' | '?';

export type GitFileStatus = {
  path: string;
  index: GitStatusCode;
  worktree: GitStatusCode;
  origPath?: string;
  stagedStats?: GitDiffStatsEntry;
  unstagedStats?: GitDiffStatsEntry;
};

export type GitBranchInfo = {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  headShort?: string;
};

export type GitDiffStatsEntry = {
  additions: number;
  deletions: number;
};

export type GitDiffStats = {
  staged: GitDiffStatsEntry;
  unstaged: GitDiffStatsEntry;
};

export const GIT_PAGER_ENV = {
  GIT_PAGER: 'cat',
  GIT_TERMINAL_PROMPT: '0',
  COLUMNS: '240',
};

/** `cat` is not on Windows PATH; `--no-pager` is enough for oneshot git. */
export function gitOneshotEnv(directory?: string) {
  if (directory && looksLikeWindowsPath(directory)) {
    return {
      GIT_TERMINAL_PROMPT: '0',
      COLUMNS: '240',
    };
  }
  return GIT_PAGER_ENV;
}

export const GIT_COMMON_ARGS = [
  '--no-pager',
  '-c',
  'core.quotepath=false',
  '-c',
  'color.ui=false',
] as const;

const EMPTY_STATS: GitDiffStats = {
  staged: { additions: 0, deletions: 0 },
  unstaged: { additions: 0, deletions: 0 },
};

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

/** ConPTY turns tabs into CSI CHA/CUF. Expand those to spaces before dropping CSI. */
function expandPtyCursor(text: string) {
  let out = '';
  let col = 0;
  for (let i = 0; i < text.length; ) {
    const ch = text[i] ?? '';
    if (ch === '\n') {
      out += '\n';
      col = 0;
      i += 1;
      continue;
    }
    if (ch === '\t') {
      const next = (Math.floor(col / 8) + 1) * 8;
      out += ' '.repeat(next - col);
      col = next;
      i += 1;
      continue;
    }
    if (ch === ESC && text[i + 1] === '[') {
      const rest = text.slice(i);
      const match = rest.match(new RegExp(`^${ESC}\\[([0-9;]*)([@-~])`));
      if (!match) {
        i += 1;
        continue;
      }
      const params = match[1] ?? '';
      const final = match[2] ?? '';
      if (final === 'G') {
        const n = Number.parseInt(params || '1', 10);
        const target = Math.max(0, (Number.isFinite(n) ? n : 1) - 1);
        if (target > col) out += ' '.repeat(target - col);
        col = target;
      } else if (final === 'C') {
        const n = Number.parseInt(params || '1', 10);
        const count = Number.isFinite(n) && n > 0 ? n : 1;
        out += ' '.repeat(count);
        col += count;
      }
      i += match[0].length;
      continue;
    }
    out += ch;
    col += 1;
    i += 1;
  }
  return out;
}

export function stripPtyNoise(output: string) {
  return expandPtyCursor(output.replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
    .replace(new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, 'g'), '')
    .replace(new RegExp(`${ESC}\\][^${BEL}]*(?:${BEL}|${ESC}\\\\)`, 'g'), '');
}

export const PTY_ONESHOT_EXIT_PREFIX = '__OPENCODE_PTY_EXIT_CODE__:';

export function looksLikeWindowsPath(value: string) {
  const trimmed = value.trim();
  return /^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\');
}

export function gitNullDevice(directory: string) {
  return looksLikeWindowsPath(directory) ? 'NUL' : '/dev/null';
}

function quoteCmdArg(value: string) {
  const escaped = value.replace(/%/g, '%%');
  if (escaped.length === 0) return '""';
  if (!/[\s"&<>^|()!]/.test(escaped)) return escaped;
  return `"${escaped.replace(/"/g, '""')}"`;
}

export function buildOneShotPtySpawn(
  directory: string | undefined,
  command: string,
  args: string[],
): { command: string; args: string[] } {
  if (directory && looksLikeWindowsPath(directory)) {
    const line = [command, ...args].map(quoteCmdArg).join(' ');
    return {
      command: 'cmd.exe',
      args: [
        '/d',
        '/s',
        '/c',
        `${line} & echo ${PTY_ONESHOT_EXIT_PREFIX}%ERRORLEVEL% & ping -n 6 127.0.0.1 >NUL`,
      ],
    };
  }
  const wrap = `stty -echo 2>/dev/null; read -r -t 1 _ || true; "$@"; code=$?; printf '\\n${PTY_ONESHOT_EXIT_PREFIX}%s\\n' "$code"; read -r -t 5 _cleanup || true; exit "$code"`;
  return {
    command: 'env',
    args: ['bash', '--noprofile', '--norc', '-c', wrap, '_', command, ...args],
  };
}

function gitCodeFromPorcelain(char: string): GitStatusCode {
  if (char === ' ' || char === '') return '';
  if (
    char === 'M' ||
    char === 'A' ||
    char === 'D' ||
    char === 'R' ||
    char === 'C' ||
    char === '?'
  ) {
    return char;
  }
  if (char === 'T' || char === 'U') return 'M';
  return '';
}

function unquoteGitPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(
        trimmed.replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(Number.parseInt(oct, 8))),
      );
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function normalizeGitRelPath(value: string): string {
  return unquoteGitPath(value).replace(/\\/g, '/').replace(/\/+$/, '');
}

// ponytail: ConPTY may emit tabs, spaces, or CSI CHA. stripPtyNoise expands cursor moves first.
const NUMSTAT_LINE = /^(-|\d+)\s+(-|\d+)\s+(.*\S)\s*$/;

export function parsePorcelainLine(line: string): GitFileStatus | null {
  if (line.length < 4) return null;
  if (line.startsWith('!!') || line.startsWith('##')) return null;
  const index = gitCodeFromPorcelain(line[0] ?? '');
  const worktree = gitCodeFromPorcelain(line[1] ?? '');
  let rest = line.slice(3);
  let origPath: string | undefined;
  const arrow = ' -> ';
  const arrowAt = rest.indexOf(arrow);
  if (arrowAt >= 0) {
    origPath = unquoteGitPath(rest.slice(0, arrowAt));
    rest = rest.slice(arrowAt + arrow.length);
  }
  const path = unquoteGitPath(rest).replace(/\/+$/, '');
  if (!path) return null;
  return origPath ? { path, index, worktree, origPath } : { path, index, worktree };
}

export function parseNumstatByPath(text: string): Record<string, GitDiffStatsEntry> {
  const byPath: Record<string, GitDiffStatsEntry> = {};
  for (const line of stripPtyNoise(text).split('\n')) {
    const match = NUMSTAT_LINE.exec(line.trim());
    if (!match) continue;
    const added = match[1] === '-' ? 0 : Number.parseInt(match[1] ?? '', 10);
    const removed = match[2] === '-' ? 0 : Number.parseInt(match[2] ?? '', 10);
    if (!Number.isFinite(added) || !Number.isFinite(removed)) continue;
    const path = normalizeGitRelPath(match[3] ?? '');
    if (!path) continue;
    const prev = byPath[path];
    byPath[path] = {
      additions: (prev?.additions ?? 0) + added,
      deletions: (prev?.deletions ?? 0) + removed,
    };
  }
  return byPath;
}

export function parseNumstatSection(text: string): GitDiffStatsEntry {
  let additions = 0;
  let deletions = 0;
  for (const entry of Object.values(parseNumstatByPath(text))) {
    additions += entry.additions;
    deletions += entry.deletions;
  }
  return { additions, deletions };
}

export function parseShortstat(text: string): GitDiffStatsEntry | null {
  const normalized = stripPtyNoise(text);
  if (!/\d+ files? changed/i.test(normalized)) return null;
  const add = normalized.match(/(\d+) insertions?\(\+\)/);
  const del = normalized.match(/(\d+) deletions?\(-\)/);
  const additions = add ? Number.parseInt(add[1] ?? '', 10) : 0;
  const deletions = del ? Number.parseInt(del[1] ?? '', 10) : 0;
  return {
    additions: Number.isFinite(additions) ? additions : 0,
    deletions: Number.isFinite(deletions) ? deletions : 0,
  };
}

function diffSectionStats(text: string): GitDiffStatsEntry {
  return parseShortstat(text) ?? parseNumstatSection(text);
}

function lookupFileNumstat(
  byPath: Record<string, GitDiffStatsEntry>,
  file: GitFileStatus,
): GitDiffStatsEntry | undefined {
  const path = normalizeGitRelPath(file.path);
  const origPath = file.origPath ? normalizeGitRelPath(file.origPath) : undefined;
  return byPath[path] ?? (origPath ? byPath[origPath] : undefined);
}

function withFileNumstat(
  files: GitFileStatus[],
  unstagedNumstat: string,
  stagedNumstat: string,
): GitFileStatus[] {
  const unstagedByPath = parseNumstatByPath(unstagedNumstat);
  const stagedByPath = parseNumstatByPath(stagedNumstat);
  return files.map((file) => {
    const unstagedStats = lookupFileNumstat(unstagedByPath, file);
    const stagedStats = lookupFileNumstat(stagedByPath, file);
    if (!unstagedStats && !stagedStats) return file;
    return { ...file, unstagedStats, stagedStats };
  });
}

function normalizeGitBranchName(raw: string): string {
  const name = raw.trim();
  if (!name || name === 'HEAD') return '(detached)';
  return name;
}

export function parseStatusBranchHeader(line: string): GitBranchInfo | null {
  if (!line.startsWith('## ')) return null;
  const rest = line.slice(3).trim();
  if (!rest || rest.startsWith('HEAD (no branch)')) {
    return { branch: '(detached)', ahead: 0, behind: 0 };
  }

  let ahead = 0;
  let behind = 0;
  let body = rest;
  const tracking = / \[(.*)\]$/.exec(body);
  if (tracking) {
    body = body.slice(0, tracking.index).trim();
    const info = tracking[1] ?? '';
    const aheadMatch = /ahead (\d+)/.exec(info);
    const behindMatch = /behind (\d+)/.exec(info);
    if (aheadMatch?.[1]) ahead = Number.parseInt(aheadMatch[1], 10);
    if (behindMatch?.[1]) behind = Number.parseInt(behindMatch[1], 10);
  }

  if (body.startsWith('No commits yet on ')) {
    return {
      branch: normalizeGitBranchName(body.slice('No commits yet on '.length)),
      ahead,
      behind,
    };
  }

  const dots = body.indexOf('...');
  if (dots >= 0) {
    return {
      branch: normalizeGitBranchName(body.slice(0, dots)),
      upstream: body.slice(dots + 3).trim() || undefined,
      ahead,
      behind,
    };
  }
  return { branch: normalizeGitBranchName(body), ahead, behind };
}

export function parseGitStatusOutput(
  statusOutput: string,
  unstagedNumstat = '',
  stagedNumstat = '',
): {
  inside: boolean;
  branch: GitBranchInfo;
  files: GitFileStatus[];
  diffStats: GitDiffStats;
} {
  const normalized = stripPtyNoise(statusOutput);
  if (/not a git repository/i.test(normalized)) {
    return {
      inside: false,
      branch: { branch: '', ahead: 0, behind: 0 },
      files: [],
      diffStats: EMPTY_STATS,
    };
  }

  let branch: GitBranchInfo = { branch: '', ahead: 0, behind: 0 };
  const files: GitFileStatus[] = [];
  for (const line of normalized.split('\n')) {
    if (!line) continue;
    const header = parseStatusBranchHeader(line);
    if (header) {
      branch = header;
      continue;
    }
    const entry = parsePorcelainLine(line);
    if (entry) files.push(entry);
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  const inside = Boolean(branch.branch) || files.length > 0;
  return {
    inside,
    branch,
    files: withFileNumstat(files, unstagedNumstat, stagedNumstat),
    diffStats: {
      staged: diffSectionStats(stagedNumstat),
      unstaged: diffSectionStats(unstagedNumstat),
    },
  };
}

export type ParsedGitBranch = {
  refname: string;
  refnameShort: string;
  displayName: string;
  isCurrent: boolean;
  isWorktree: boolean;
  isLocal: boolean;
  remote: string;
};

/** `git branch -a --no-color` — avoid `%(refname)` (cmd.exe + `%` doubling). */
export function parseGitBranchList(output: string): ParsedGitBranch[] {
  const seen = new Set<string>();
  const entries: ParsedGitBranch[] = [];

  for (const raw of stripPtyNoise(output).split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line) continue;
    if (line.includes(PTY_ONESHOT_EXIT_PREFIX)) continue;
    if (line.includes(' -> ')) continue;

    const body = line.trimStart();
    let marker = ' ';
    let name = body;
    if (body.startsWith('* ') || body.startsWith('+ ')) {
      marker = body[0] ?? ' ';
      name = body.slice(2).trim();
    } else {
      name = body.trim();
    }
    if (!name || name.startsWith('(') || /[\s:%]/.test(name)) continue;
    if (/[\\>]/.test(name) || /^[A-Za-z]:/.test(name)) continue;

    const isRemote = name.startsWith('remotes/');
    const short = isRemote ? name.slice('remotes/'.length) : name;
    const slash = short.indexOf('/');
    const remote = isRemote && slash > 0 ? short.slice(0, slash) : '';
    const displayName = isRemote && slash > 0 ? short.slice(slash + 1) : short;
    if (!displayName || displayName === 'HEAD') continue;

    const refname = isRemote ? `refs/remotes/${short}` : `refs/heads/${short}`;
    if (seen.has(refname)) continue;
    seen.add(refname);

    entries.push({
      refname,
      refnameShort: short,
      displayName,
      isCurrent: marker === '*',
      isWorktree: marker === '+',
      isLocal: !isRemote,
      remote,
    });
  }

  return entries;
}
