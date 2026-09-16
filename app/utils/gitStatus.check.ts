import {
  parseGitStatusOutput,
  parsePorcelainLine,
  parseStatusBranchHeader,
  parseGitBranchList,
  buildOneShotPtySpawn,
} from './gitStatus.ts';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const header = parseStatusBranchHeader('## main...origin/main [ahead 1, behind 2]');
assert(header?.branch === 'main', 'branch name');
assert(header?.upstream === 'origin/main', 'upstream');
assert(header?.ahead === 1, 'ahead');
assert(header?.behind === 2, 'behind');

assert(parseStatusBranchHeader('## HEAD (no branch)')?.branch === '(detached)', 'detached');

const modified = parsePorcelainLine(' M app/file.ts');
assert(modified?.path === 'app/file.ts', 'modified path');
assert(modified?.index === '', 'unstaged index col');
assert(modified?.worktree === 'M', 'unstaged worktree col');

const staged = parsePorcelainLine('M  app/file.ts');
assert(staged?.index === 'M' && staged?.worktree === '', 'staged only');

const untracked = parsePorcelainLine('?? new file.ts');
assert(untracked?.path === 'new file.ts', 'untracked space in name');
assert(untracked?.index === '?' && untracked?.worktree === '?', 'untracked marks');

const crlf = parseGitStatusOutput(
  '## feature\r\nM  staged.ts\r\n M changes.ts\r\n?? untracked.ts\r\n',
  '1\t2\tchanges.ts\n',
  '3\t4\tstaged.ts\n',
);
assert(crlf.inside, 'inside repo');
assert(crlf.branch.branch === 'feature', 'crlf branch');
assert(crlf.files.length === 3, 'three files');
assert(crlf.diffStats.unstaged.additions === 1 && crlf.diffStats.unstaged.deletions === 2, 'unstaged stats');
assert(crlf.diffStats.staged.additions === 3 && crlf.diffStats.staged.deletions === 4, 'staged stats');
assert(crlf.files.find((f) => f.path === 'changes.ts')?.unstagedStats?.additions === 1, 'per-file unstaged add');
assert(crlf.files.find((f) => f.path === 'changes.ts')?.unstagedStats?.deletions === 2, 'per-file unstaged del');
assert(crlf.files.find((f) => f.path === 'staged.ts')?.stagedStats?.additions === 3, 'per-file staged add');
assert(!crlf.files.find((f) => f.path === 'untracked.ts')?.unstagedStats, 'untracked has no numstat');

const missing = parseGitStatusOutput('fatal: not a git repository (or any of the parent directories): .git\n');
assert(!missing.inside && missing.files.length === 0, 'missing repo');

const unix = buildOneShotPtySpawn('/Users/me/proj', 'git', ['status']);
assert(unix.command === 'env', 'unix trampoline');
assert(unix.args[0] === 'bash', 'unix bash');
assert(unix.args.includes('git') && unix.args.includes('status'), 'unix git argv');

const win = buildOneShotPtySpawn('C:/Users/me/proj', 'git', ['branch', `--format=%(refname)`]);
assert(win.command === 'cmd.exe', 'windows trampoline');
assert(win.args.at(-1)?.includes('%%(refname)'), 'cmd percent escape');
assert(win.args.at(-1)?.includes('__OPENCODE_PTY_EXIT_CODE__'), 'windows exit marker');

const branches = parseGitBranchList(
  [
    '* main',
    '  feature/win',
    '+ worktree-branch',
    '  remotes/origin/HEAD -> origin/main',
    '  remotes/origin/main',
    'Pinging 127.0.0.1 with 32 bytes of data:',
    'C:\\Users\\me>',
    '* (HEAD detached at abc123)',
  ].join('\r\n'),
);
assert(branches.length === 4, 'four branch refs');
assert(branches.some((b) => b.displayName === 'main' && b.isCurrent && b.isLocal), 'current main');
assert(branches.some((b) => b.displayName === 'feature/win' && b.isLocal), 'local feature');
assert(branches.some((b) => b.displayName === 'worktree-branch' && b.isWorktree), 'worktree');
assert(
  branches.some((b) => b.displayName === 'main' && b.remote === 'origin' && !b.isLocal),
  'remote main',
);
assert(!branches.some((b) => b.displayName === 'HEAD'), 'skip remote HEAD');

console.log('gitStatus self-check ok');
