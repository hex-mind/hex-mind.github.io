export type WorktreeSnapshotMode = 'staged' | 'changes' | 'all';

export type CommitSnapshotEntry = {
  status: string;
  file: string;
  before: string;
  after: string;
  beforeBase64: string;
  afterBase64: string;
};

export type CommitSnapshotResult = {
  title: string;
  files: CommitSnapshotEntry[];
};

export type FileSnapshotResult = {
  before: string;
  after: string;
  beforeBase64: string;
  afterBase64: string;
};

export const COMMIT_SNAPSHOT_SCRIPT = [
  'stty -opost -echo 2>/dev/null',
  'export GIT_PAGER=cat',
  'export GIT_TERMINAL_PROMPT=0',
  'h=$1',
  'printf "##TITLE\\t%s\\n" "$(git --no-pager log --format="%h %s" -1 "$h" 2>/dev/null)"',
  'git diff-tree --no-commit-id -r --name-status --find-renames --find-copies --first-parent --root "$h" 2>/dev/null | while IFS="$(printf "\\t")" read -r st p1 p2; do',
  '  code=${st%"${st#?}"}',
  '  old=$p1',
  '  new=$p1',
  '  if [ "$code" = "R" ] || [ "$code" = "C" ]; then',
  '    old=$p1',
  '    new=$p2',
  '  fi',
  '  printf "##FILE\\t%s\\t%s\\n" "$st" "$new"',
  '  printf "##BEFORE\\n"',
  '  if [ "$code" != "A" ]; then',
  '    git --no-pager show "$h^:$old" 2>/dev/null | base64 -w 76',
  '  fi',
  '  printf "##AFTER\\n"',
  '  if [ "$code" != "D" ]; then',
  '    git --no-pager show "$h:$new" 2>/dev/null | base64 -w 76',
  '  fi',
  'done',
].join('\n');

export const FILE_SNAPSHOT_SCRIPT = [
  'stty -opost -echo 2>/dev/null',
  'export GIT_PAGER=cat',
  'export GIT_TERMINAL_PROMPT=0',
  'mode=$1',
  'path=$2',
  'printf "##BEFORE\\n"',
  'if [ "$mode" = "staged" ]; then',
  '  git --no-pager show "HEAD:$path" 2>/dev/null | base64 -w 76',
  'else',
  '  git --no-pager show ":$path" 2>/dev/null | base64 -w 76',
  'fi',
  'printf "##AFTER\\n"',
  'if [ "$mode" = "staged" ]; then',
  '  git --no-pager show ":$path" 2>/dev/null | base64 -w 76',
  'else',
  '  if [ -f "$path" ]; then',
  '    base64 -w 76 < "$path"',
  '  fi',
  'fi',
].join('\n');

export function buildWorktreeSnapshotScript(mode: WorktreeSnapshotMode): string {
  const title =
    mode === 'staged'
      ? 'Staged changes'
      : mode === 'changes'
        ? 'Unstaged changes'
        : 'Working tree (staged + changes)';
  let filterLines: string[];
  if (mode === 'staged') {
    filterLines = ['  [ "$x" = " " ] && continue', '  [ "$x" = "?" ] && continue'];
  } else if (mode === 'changes') {
    filterLines = ['  [ "$y" = " " ] && continue'];
  } else {
    filterLines = ['  [ "$x" = "?" ] && [ "$y" = "?" ] && continue'];
  }
  let beforeLines: string[];
  let afterLines: string[];
  if (mode === 'staged') {
    beforeLines = [
      '  printf "##BEFORE\\n"',
      '  if [ "$code" != "A" ]; then',
      '    git --no-pager show "HEAD:$old" 2>/dev/null | base64 -w 76',
      '  fi',
    ];
    afterLines = [
      '  printf "##AFTER\\n"',
      '  if [ "$code" != "D" ]; then',
      '    git --no-pager show ":$new" 2>/dev/null | base64 -w 76',
      '  fi',
    ];
  } else if (mode === 'changes') {
    beforeLines = [
      '  printf "##BEFORE\\n"',
      '  if [ "$code" != "A" ]; then',
      '    git --no-pager show ":$old" 2>/dev/null | base64 -w 76',
      '  fi',
    ];
    afterLines = [
      '  printf "##AFTER\\n"',
      '  if [ "$code" != "D" ] && [ -f "$new" ]; then',
      '    base64 -w 76 < "$new"',
      '  fi',
    ];
  } else {
    beforeLines = [
      '  printf "##BEFORE\\n"',
      '  if [ "$code" != "A" ]; then',
      '    git --no-pager show "HEAD:$old" 2>/dev/null | base64 -w 76',
      '  fi',
    ];
    afterLines = [
      '  printf "##AFTER\\n"',
      '  if [ "$code" != "D" ] && [ -f "$new" ]; then',
      '    base64 -w 76 < "$new"',
      '  fi',
    ];
  }
  return [
    'stty -opost -echo 2>/dev/null',
    'export GIT_PAGER=cat',
    'export GIT_TERMINAL_PROMPT=0',
    `printf "##TITLE\\t${title}\\n"`,
    'git --no-pager status --porcelain=v1 2>/dev/null | while IFS= read -r line; do',
    '  [ -z "$line" ] && continue',
    '  x=${line%"${line#?}"}',
    '  rest=${line#?}',
    '  y=${rest%"${rest#?}"}',
    ...filterLines,
    '  path=${line#???}',
    '  old=$path',
    '  new=$path',
    '  code=M',
    '  if [ "$x" = "D" ] || [ "$y" = "D" ]; then',
    '    code=D',
    '  elif [ "$x" = "?" ]; then',
    '    code=A',
    '  elif [ "$x" = "A" ]; then',
    '    code=A',
    '  elif [ "$x" = "R" ] || [ "$y" = "R" ]; then',
    '    code=R',
    '    old=${path%% -> *}',
    '    new=${path#* -> }',
    '  elif [ "$x" = "C" ] || [ "$y" = "C" ]; then',
    '    code=C',
    '    old=${path%% -> *}',
    '    new=${path#* -> }',
    '  fi',
    '  printf "##FILE\\t%s\\t%s\\n" "$code" "$new"',
    ...beforeLines,
    ...afterLines,
    'done',
  ].join('\n');
}

export function toUint8ArrayFromBase64(input: string) {
  const decoded = atob(input);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
}

function decodeCommitSnapshotBase64(value: string) {
  if (!value) return '';
  return new TextDecoder().decode(toUint8ArrayFromBase64(value));
}

export function parseCommitSnapshotOutput(rawOutput: string): CommitSnapshotResult {
  const files: CommitSnapshotEntry[] = [];
  let title = '';
  let section: 'none' | 'before' | 'after' = 'none';
  let current:
    | {
        status: string;
        file: string;
        before: string[];
        after: string[];
      }
    | undefined;

  const pushCurrent = () => {
    if (!current || !current.file) {
      current = undefined;
      section = 'none';
      return;
    }
    const beforeBase64 = current.before.join('');
    const afterBase64 = current.after.join('');
    files.push({
      status: current.status,
      file: current.file,
      before: decodeCommitSnapshotBase64(beforeBase64),
      after: decodeCommitSnapshotBase64(afterBase64),
      beforeBase64,
      afterBase64,
    });
    current = undefined;
    section = 'none';
  };

  for (const rawLine of rawOutput.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line.startsWith('##TITLE\t')) {
      title = line.slice('##TITLE\t'.length);
      continue;
    }
    if (line.startsWith('##FILE\t')) {
      pushCurrent();
      const payload = line.slice('##FILE\t'.length);
      const separator = payload.indexOf('\t');
      const status = separator >= 0 ? payload.slice(0, separator) : payload;
      const file = separator >= 0 ? payload.slice(separator + 1) : '';
      current = { status, file, before: [], after: [] };
      section = 'none';
      continue;
    }
    if (line === '##BEFORE') {
      section = 'before';
      continue;
    }
    if (line === '##AFTER') {
      section = 'after';
      continue;
    }
    if (!current || line.length === 0) continue;
    if (section === 'before') {
      current.before.push(line);
    } else if (section === 'after') {
      current.after.push(line);
    }
  }

  pushCurrent();
  return { title, files };
}

export function parseFileSnapshotOutput(rawOutput: string): FileSnapshotResult {
  const lines = rawOutput.split(/\r?\n/);
  let section: 'none' | 'before' | 'after' = 'none';
  const before: string[] = [];
  const after: string[] = [];
  for (const line of lines) {
    if (line === '##BEFORE') {
      section = 'before';
      continue;
    }
    if (line === '##AFTER') {
      section = 'after';
      continue;
    }
    if (!line) continue;
    if (section === 'before') {
      before.push(line);
      continue;
    }
    if (section === 'after') {
      after.push(line);
    }
  }

  const beforeBase64 = before.join('');
  const afterBase64 = after.join('');
  return {
    before: decodeCommitSnapshotBase64(beforeBase64),
    after: decodeCommitSnapshotBase64(afterBase64),
    beforeBase64,
    afterBase64,
  };
}
