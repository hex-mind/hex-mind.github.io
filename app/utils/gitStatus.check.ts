import {
  parseGitStatusOutput,
  parseNumstatByPath,
  parsePorcelainLine,
  parseStatusBranchHeader,
  parseGitBranchList,
  parseShortstat,
  stripPtyNoise,
  gitOneshotEnv,
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

// Windows ConPTY expands numstat tabs to spaces; file names can contain spaces.
const conpty = parseGitStatusOutput(
  '## feature\r\nM  staged.ts\r\n M src/my file.ts\r\n M src/also.ts\r\n?? untracked.ts\r\n',
  [
    'C:\\Users\\me>',
    '10      5       src/my file.ts',
    '1       1       src\\also.ts',
    'Pinging 127.0.0.1 with 32 bytes of data:',
    '__OPENCODE_PTY_EXIT_CODE__:0',
  ].join('\r\n'),
  '3       4       staged.ts\n',
);
assert(conpty.diffStats.unstaged.additions === 11 && conpty.diffStats.unstaged.deletions === 6, 'conpty unstaged');
assert(conpty.diffStats.staged.additions === 3 && conpty.diffStats.staged.deletions === 4, 'conpty staged');
assert(conpty.files.find((f) => f.path === 'src/my file.ts')?.unstagedStats?.additions === 10, 'conpty spaced path');
assert(conpty.files.find((f) => f.path === 'src/also.ts')?.unstagedStats?.deletions === 1, 'conpty backslash path');
assert(conpty.files.find((f) => f.path === 'staged.ts')?.stagedStats?.deletions === 4, 'conpty staged del');

const expanded = parseNumstatByPath('-\t-\tbinary.png\n1000\t2\twide.ts\n');
assert(expanded['binary.png']?.additions === 0 && expanded['binary.png']?.deletions === 0, 'binary numstat');
assert(expanded['wide.ts']?.additions === 1000 && expanded['wide.ts']?.deletions === 2, 'tab numstat still works');

const esc = String.fromCharCode(27);
const csiNumstat = parseNumstatByPath(`10${esc}[9G5${esc}[17Gsrc/my file.ts\n`);
assert(csiNumstat['src/my file.ts']?.additions === 10, 'csi cha additions');
assert(csiNumstat['src/my file.ts']?.deletions === 5, 'csi cha deletions');
assert(!stripPtyNoise(`10${esc}[9G5${esc}[17Gsrc/my file.ts`).includes(esc), 'csi stripped after expand');

const shortOnly = parseGitStatusOutput(
  '## feature\r\n M changes.ts\r\n',
  `105changes.ts\r\n 1 file changed, 10 insertions(+), 5 deletions(-)\r\n`,
  ' 1 file changed, 3 insertions(+)\n',
);
assert(shortOnly.diffStats.unstaged.additions === 10 && shortOnly.diffStats.unstaged.deletions === 5, 'shortstat totals');
assert(shortOnly.diffStats.staged.additions === 3 && shortOnly.diffStats.staged.deletions === 0, 'shortstat add only');
assert(parseShortstat('oops') === null, 'shortstat missing');

assert(gitOneshotEnv('C:/proj').GIT_PAGER === undefined, 'windows oneshot has no cat pager');
assert(gitOneshotEnv('/tmp/proj').GIT_PAGER === 'cat', 'unix oneshot keeps cat pager');

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
