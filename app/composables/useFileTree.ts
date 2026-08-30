import { computed, ref, watch } from 'vue';
import type { Ref } from 'vue';
import type { FileWatcherUpdatedPacket } from '../types/sse';
import * as opencodeApi from '../utils/opencode';
import { stripTrailingSlashes as normalizeDirectory } from '../utils/path';
import { usePtyOneshot } from './usePtyOneshot';

export type TreeNode = {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: TreeNode[];
  loaded?: boolean;
  ignored?: boolean;
  synthetic?: boolean;
};

export type FileNode = {
  name?: string;
  path: string;
  type?: string;
  ignored?: boolean;
};

export type GitStatusCode = '' | 'M' | 'A' | 'D' | 'R' | 'C' | '?';

export type GitFileStatus = {
  path: string;
  index: GitStatusCode;
  worktree: GitStatusCode;
  origPath?: string;
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

export type BranchEntry = {
  refname: string;
  refnameShort: string;
  displayName: string;
  hash: string;
  subject: string;
  isCurrent: boolean;
  isWorktree: boolean;
  isLocal: boolean;
  remote: string;
  upstream: string;
  hasLocalCounterpart: boolean;
};

export type GitStatus = {
  branch: GitBranchInfo;
  files: GitFileStatus[];
  diffStats: GitDiffStats;
};

type UseFileTreeOptions = {
  activeDirectory: Ref<string>;
};

let boundOptions: UseFileTreeOptions | null = null;

const treeNodes = ref<TreeNode[]>([]);
const expandedTreePathSet = ref(new Set<string>());
const selectedTreePath = ref('');
const treeLoading = ref(false);
const treeError = ref('');
const gitStatus = ref<GitStatus | null>(null);
const gitStatusByPath = ref<Record<string, GitFileStatus>>({});
const gitStatusLoading = ref(false);
const files = ref<string[]>([]);
const fileCacheVersion = ref(0);
const branchEntries = ref<BranchEntry[]>([]);
const branchListLoading = ref(false);

let fileCacheBuildId = 0;
const DIRECTORY_RELOAD_DEBOUNCE_MS = 120;
const AUTO_SCAN_FILE_LIMIT = 1000;
const scheduledDirectoryReloads = new Map<string, ReturnType<typeof setTimeout>>();
let gitStatusGeneration = 0;
let branchListGeneration = 0;

const BRANCH_LIST_FORMAT =
  '%(refname)\t%(refname:short)\t%(HEAD)\t%(worktreepath)\t%(objectname:short)\t%(subject)\t%(upstream:short)';

function getOptions(): UseFileTreeOptions {
  if (!boundOptions) {
    throw new Error('useFileTree must be initialized with options before use');
  }
  return boundOptions;
}

function normalizeRelativePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '.') return '.';
  const withoutPrefix = trimmed
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .replace(/^(\.\.\/)+/, '');
  const normalized = withoutPrefix.replace(/\/+/g, '/').replace(/\/$/, '');
  return normalized || '.';
}

function toRelativePath(path: string, directory: string) {
  const normalizedDirectory = normalizeDirectory(directory);
  const normalizedPath = normalizeDirectory(path);
  if (normalizedPath === normalizedDirectory) return '.';
  const prefix = `${normalizedDirectory}/`;
  if (normalizedPath.startsWith(prefix)) {
    return normalizeRelativePath(normalizedPath.slice(prefix.length));
  }
  return normalizeRelativePath(normalizedPath);
}

function normalizeFileNode(item: unknown, directory: string): FileNode | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const rawPath =
    (typeof record.path === 'string' && record.path) ||
    (typeof record.name === 'string' && record.name) ||
    undefined;
  if (!rawPath) return null;
  const path = toRelativePath(rawPath, directory);
  const name =
    (typeof record.name === 'string' && record.name) ||
    (path === '.' ? '.' : path.split('/').at(-1)) ||
    path;
  const rawType = typeof record.type === 'string' ? record.type.toLowerCase() : '';
  const type = rawType.includes('dir') ? 'directory' : 'file';
  const ignored = Boolean(record.ignored);
  return { path, name, type, ignored };
}

function sortTreeNodes(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

function buildTreeNodes(items: unknown[], directory: string, parentPath: string) {
  const unique = new Map<string, TreeNode>();
  items.forEach((item) => {
    const node = normalizeFileNode(item, directory);
    if (!node) return;
    if (node.path === parentPath || node.path === '.') return;
    const relativeToParent =
      parentPath === '.'
        ? node.path
        : node.path.startsWith(`${parentPath}/`)
          ? node.path.slice(parentPath.length + 1)
          : node.path.includes('/')
            ? ''
            : node.path;
    if (!relativeToParent) return;
    const name = relativeToParent.split('/')[0];
    const path = parentPath === '.' ? name : `${parentPath}/${name}`;
    const isLeaf = !relativeToParent.includes('/');
    const existing = unique.get(path);
    if (existing) {
      if (existing.type === 'file' && !isLeaf) {
        existing.type = 'directory';
        existing.children = [];
      }
      if (node.ignored) existing.ignored = true;
      return;
    }
    const normalizedType: TreeNode['type'] = node.type === 'directory' ? 'directory' : 'file';
    unique.set(path, {
      name,
      path,
      type: isLeaf ? normalizedType : 'directory',
      children: isLeaf && normalizedType !== 'directory' ? undefined : [],
      loaded: false,
      ignored: Boolean(node.ignored),
      synthetic: false,
    });
  });
  return sortTreeNodes(Array.from(unique.values()));
}

function updateTreeNodeChildren(
  nodes: TreeNode[],
  targetPath: string,
  children: TreeNode[],
): TreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return {
        ...node,
        type: 'directory',
        children,
        loaded: true,
      };
    }
    if (node.children?.length) {
      return { ...node, children: updateTreeNodeChildren(node.children, targetPath, children) };
    }
    return node;
  });
}

function findTreeNodeByPath(nodes: TreeNode[], targetPath: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (!node.children?.length) continue;
    const child = findTreeNodeByPath(node.children, targetPath);
    if (child) return child;
  }
  return null;
}

function clearScheduledDirectoryReloads() {
  scheduledDirectoryReloads.forEach((timer) => clearTimeout(timer));
  scheduledDirectoryReloads.clear();
}

function isPathInsideDirectory(path: string, directory: string) {
  const normalizedDirectory = normalizeDirectory(directory);
  const normalizedPath = normalizeDirectory(path);
  if (!normalizedDirectory || !normalizedPath) return false;
  return (
    normalizedPath === normalizedDirectory || normalizedPath.startsWith(`${normalizedDirectory}/`)
  );
}

function parentDirectoryPath(relativePath: string) {
  if (!relativePath.includes('/')) return '.';
  return relativePath.slice(0, relativePath.lastIndexOf('/')) || '.';
}

function mergeTreeNodeChildren(existing: TreeNode[], incoming: TreeNode[]) {
  if (existing.length === 0 || incoming.length === 0) return incoming;
  const existingByPath = new Map(existing.map((node) => [node.path, node]));
  return incoming.map((node) => {
    const previous = existingByPath.get(node.path);
    if (
      node.type === 'directory' &&
      previous?.type === 'directory' &&
      previous.loaded &&
      Array.isArray(previous.children)
    ) {
      return {
        ...node,
        children: previous.children,
        loaded: true,
      };
    }
    return node;
  });
}

function replaceDirectoryFilesInCache(parentPath: string, children: TreeNode[]) {
  const directFiles = children.filter((node) => node.type === 'file').map((node) => node.path);
  const preserved = files.value.filter((filePath) => {
    if (parentPath === '.') {
      return filePath.includes('/');
    }
    const prefix = `${parentPath}/`;
    if (!filePath.startsWith(prefix)) return true;
    return filePath.slice(prefix.length).includes('/');
  });
  const next = Array.from(new Set([...preserved, ...directFiles])).sort((a, b) =>
    a.localeCompare(b),
  );
  const changed =
    next.length !== files.value.length || next.some((path, index) => path !== files.value[index]);
  if (!changed) return;
  files.value = next;
  fileCacheVersion.value += 1;
}

function scheduleDirectoryReload(path: string) {
  const timer = scheduledDirectoryReloads.get(path);
  if (timer !== undefined) {
    clearTimeout(timer);
  }
  scheduledDirectoryReloads.set(
    path,
    setTimeout(() => {
      scheduledDirectoryReloads.delete(path);
      void loadSingleDirectory(path);
    }, DIRECTORY_RELOAD_DEBOUNCE_MS),
  );
}

const GIT_STATUS_SCRIPT = [
  'export GIT_PAGER=cat',
  'export GIT_TERMINAL_PROMPT=0',
  'printf "##GIT\\n"',
  'if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then',
  '  printf "1\\n"',
  '  printf "##BRANCH\\n"',
  '  git -c core.quotepath=false symbolic-ref --short -q HEAD || printf "(detached)\\n"',
  'else',
  '  printf "0\\n"',
  '  printf "##BRANCH\\n"',
  'fi',
  'printf "##STATUS\\n"',
  'git --no-pager -c core.quotepath=false status --porcelain=v1 2>/dev/null',
  'printf "##UNSTAGED\\n"',
  'git --no-pager -c core.quotepath=false diff --numstat 2>/dev/null',
  'printf "##STAGED\\n"',
  'git --no-pager -c core.quotepath=false diff --cached --numstat 2>/dev/null',
].join('\n');

function gitCodeFromPorcelain(char: string): GitStatusCode {
  if (char === ' ' || char === '') return '';
  if (char === 'M' || char === 'A' || char === 'D' || char === 'R' || char === 'C' || char === '?') {
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

function parsePorcelainLine(line: string): GitFileStatus | null {
  if (line.length < 4) return null;
  if (line.startsWith('!!')) return null;
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

function parseNumstatSection(text: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const added = parts[0] === '-' ? 0 : Number.parseInt(parts[0] ?? '', 10);
    const removed = parts[1] === '-' ? 0 : Number.parseInt(parts[1] ?? '', 10);
    if (Number.isFinite(added)) additions += added;
    if (Number.isFinite(removed)) deletions += removed;
  }
  return { additions, deletions };
}

function normalizeGitBranchName(raw: string): string {
  const name = raw.trim();
  if (!name || name === 'HEAD') return '(detached)';
  return name;
}

function parseGitStatusOutput(output: string): {
  inside: boolean;
  branch: string;
  files: GitFileStatus[];
  diffStats: GitDiffStats;
} {
  const normalized = output.replace(/\r/g, '');
  const take = (name: string) => {
    const start = normalized.indexOf(`##${name}\n`);
    if (start < 0) return '';
    const from = start + name.length + 3;
    const next = normalized.indexOf('\n##', from);
    return (next < 0 ? normalized.slice(from) : normalized.slice(from, next)).replace(/\n+$/, '');
  };
  const gitMark = take('GIT').split('\n')[0]?.trim();
  const inside = gitMark ? gitMark === '1' : Boolean(take('BRANCH') || take('STATUS'));
  const branch = normalizeGitBranchName(take('BRANCH').split('\n')[0] ?? '');
  const files = take('STATUS')
    .split('\n')
    .map((line) => parsePorcelainLine(line))
    .filter((entry): entry is GitFileStatus => Boolean(entry))
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    inside,
    branch,
    files,
    diffStats: {
      staged: parseNumstatSection(take('STAGED')),
      unstaged: parseNumstatSection(take('UNSTAGED')),
    },
  };
}

function setGitStatus(next: GitStatus | null) {
  gitStatus.value = next;
  if (!next) {
    gitStatusByPath.value = {};
    return;
  }
  const byPath: Record<string, GitFileStatus> = {};
  next.files.forEach((entry) => {
    byPath[entry.path] = entry;
  });
  gitStatusByPath.value = byPath;
}

async function refreshGitStatusOnly() {
  const { activeDirectory } = getOptions();
  const directory = activeDirectory.value.trim();
  if (!directory) {
    setGitStatus(null);
    return;
  }

  const generation = ++gitStatusGeneration;
  const { runOneShotPtyCommand } = usePtyOneshot();
  try {
    const output = await runOneShotPtyCommand('bash', ['-c', GIT_STATUS_SCRIPT]);
    if (generation !== gitStatusGeneration) return;
    if (getOptions().activeDirectory.value.trim() !== directory) return;

    const parsed = parseGitStatusOutput(output);
    if (!parsed.inside) {
      setGitStatus({
        branch: { branch: '', ahead: 0, behind: 0 },
        files: [],
        diffStats: {
          staged: { additions: 0, deletions: 0 },
          unstaged: { additions: 0, deletions: 0 },
        },
      });
      return;
    }
    setGitStatus({
      branch: {
        branch: parsed.branch,
        ahead: 0,
        behind: 0,
      },
      files: parsed.files,
      diffStats: parsed.diffStats,
    });
  } catch {
    if (generation !== gitStatusGeneration) return;
    setGitStatus(null);
  }
}

async function refreshGitStatus() {
  gitStatusLoading.value = true;
  try {
    await refreshGitStatusOnly();
  } finally {
    gitStatusLoading.value = false;
  }
}

function parseBranchEntries(output: string): BranchEntry[] {
  const entries: BranchEntry[] = [];
  const lines = output.split(/\r?\n/);

  lines.forEach((line) => {
    if (!line) return;
    const parts = line.split('\t');
    if (parts.length < 7) return;
    const [refname = '', refnameShort = '', head = '', worktreePath = '', hash = '', ...rest] =
      parts;
    const upstream = rest.at(-1)?.trim() ?? '';
    const subject = rest.slice(0, -1).join('\t').trim();

    const headMark = head.trim();
    const isCurrent = headMark === '*';
    const isWorktree = worktreePath.trim().length > 0;

    if (refname.startsWith('refs/heads/')) {
      const displayName = refname.slice('refs/heads/'.length);
      if (!displayName) return;
      entries.push({
        refname,
        refnameShort,
        displayName,
        hash,
        subject,
        isCurrent,
        isWorktree,
        isLocal: true,
        remote: '',
        upstream,
        hasLocalCounterpart: false,
      });
      return;
    }

    if (!refname.startsWith('refs/remotes/')) return;
    const remoteRelative = refname.slice('refs/remotes/'.length);
    const splitIndex = remoteRelative.indexOf('/');
    if (splitIndex <= 0) return;
    const remote = remoteRelative.slice(0, splitIndex);
    const displayName = remoteRelative.slice(splitIndex + 1);
    if (!displayName || displayName === 'HEAD') return;
    entries.push({
      refname,
      refnameShort,
      displayName,
      hash,
      subject,
      isCurrent,
      isWorktree,
      isLocal: false,
      remote,
      upstream,
      hasLocalCounterpart: false,
    });
  });

  const localNames = new Set(
    entries.filter((entry) => entry.isLocal).map((entry) => entry.displayName),
  );

  entries.forEach((entry) => {
    if (entry.isLocal) return;
    entry.hasLocalCounterpart = localNames.has(entry.displayName);
  });

  return entries;
}

async function refreshBranchEntries() {
  const { activeDirectory } = getOptions();
  const directory = activeDirectory.value.trim();
  if (!directory) {
    branchEntries.value = [];
    return;
  }

  const generation = ++branchListGeneration;
  branchListLoading.value = true;
  const { runOneShotPtyCommand } = usePtyOneshot();
  try {
    const output = await runOneShotPtyCommand('git', [
      '--no-pager',
      '-c',
      'color.ui=false',
      '-c',
      'color.branch=false',
      'branch',
      '--no-color',
      '-a',
      '--sort=-committerdate',
      `--format=${BRANCH_LIST_FORMAT}`,
    ]);
    if (generation !== branchListGeneration) return;
    branchEntries.value = parseBranchEntries(output);
  } catch {
    if (generation !== branchListGeneration) return;
    branchEntries.value = [];
  } finally {
    if (generation === branchListGeneration) {
      branchListLoading.value = false;
    }
  }
}

function toggleTreeDirectory(path: string) {
  const next = new Set(expandedTreePathSet.value);
  if (next.has(path)) {
    next.delete(path);
    expandedTreePathSet.value = next;
    return;
  }
  next.add(path);
  expandedTreePathSet.value = next;
  const node = findTreeNodeByPath(treeNodes.value, path);
  if (node?.loaded) return;
  void loadSingleDirectory(path);
}

function selectTreeFile(path: string) {
  selectedTreePath.value = selectedTreePath.value === path ? '' : path;
}

const expandedTreePaths = computed(() => Array.from(expandedTreePathSet.value));

async function loadSingleDirectory(path: string) {
  const options = getOptions();
  const directory = options.activeDirectory.value.trim();
  if (!directory) return;
  try {
    const data = await opencodeApi.listFiles({ directory, path });
    if (options.activeDirectory.value.trim() !== directory) return;
    const list = Array.isArray(data) ? data : [];
    const children = buildTreeNodes(list, directory, path);
    if (path === '.') {
      const mergedRootNodes = mergeTreeNodeChildren(treeNodes.value, children);
      treeNodes.value = mergedRootNodes;
      replaceDirectoryFilesInCache(path, mergedRootNodes);
      return;
    }

    const parent = findTreeNodeByPath(treeNodes.value, path);
    const mergedChildren = mergeTreeNodeChildren(parent?.children ?? [], children);
    treeNodes.value = updateTreeNodeChildren(treeNodes.value, path, mergedChildren);
    replaceDirectoryFilesInCache(path, mergedChildren);
  } catch (error) {
    treeError.value = opencodeApi.formatDirectoryListError(error);
  }
}

function feed(packet: FileWatcherUpdatedPacket) {
  const options = getOptions();
  const directory = options.activeDirectory.value.trim();
  if (!directory) return;
  if (!isPathInsideDirectory(packet.file, directory)) return;
  if (treeLoading.value) return;

  const relativePath = toRelativePath(packet.file, directory);
  if (relativePath === '.') return;

  if (packet.event === 'unlink') {
    const next = files.value.filter(
      (path) => path !== relativePath && !path.startsWith(`${relativePath}/`),
    );
    if (next.length !== files.value.length) {
      files.value = next;
      fileCacheVersion.value += 1;
    }
  }

  if (packet.event !== 'change') {
    scheduleDirectoryReload(parentDirectoryPath(relativePath));
  }
}

async function rebuildFileCache() {
  const options = getOptions();
  const directory = options.activeDirectory.value.trim();
  const buildId = ++fileCacheBuildId;
  treeLoading.value = true;
  treeError.value = '';
  if (!directory) {
    treeNodes.value = [];
    files.value = [];
    fileCacheVersion.value += 1;
    treeLoading.value = false;
    return;
  }

  try {
    const data = await opencodeApi.listFiles({ directory, path: '.' });
    if (buildId !== fileCacheBuildId) return;
    if (options.activeDirectory.value.trim() !== directory) return;

    const list = Array.isArray(data) ? data : [];
    const children = buildTreeNodes(list, directory, '.');
    treeNodes.value = children;
    replaceDirectoryFilesInCache('.', children);
    treeError.value = '';
    treeLoading.value = false;
    void scanFilesInBackground(directory, buildId, children);
  } catch (error) {
    if (buildId !== fileCacheBuildId) return;
    if (options.activeDirectory.value.trim() !== directory) return;
    treeNodes.value = [];
    files.value = [];
    fileCacheVersion.value += 1;
    treeError.value = opencodeApi.formatDirectoryListError(error);
    treeLoading.value = false;
  }
}

async function scanFilesInBackground(directory: string, buildId: number, rootChildren: TreeNode[]) {
  const queue = rootChildren
    .filter((child) => child.type === 'directory' && !child.ignored)
    .map((child) => child.path);
  const visited = new Set<string>(['.']);
  const collected = files.value.slice();

  try {
    while (queue.length > 0) {
      if (buildId !== fileCacheBuildId) return;
      if (getOptions().activeDirectory.value.trim() !== directory) return;
      const path = queue.shift();
      if (!path || visited.has(path)) continue;
      visited.add(path);

      const data = await opencodeApi.listFiles({ directory, path });
      if (buildId !== fileCacheBuildId) return;
      const list = Array.isArray(data) ? data : [];
      const children = buildTreeNodes(list, directory, path);
      for (const child of children) {
        if (child.type === 'file') {
          collected.push(child.path);
          continue;
        }
        if (!child.ignored && !visited.has(child.path)) queue.push(child.path);
      }
      if (collected.length > AUTO_SCAN_FILE_LIMIT) break;
    }

    if (buildId !== fileCacheBuildId) return;
    if (getOptions().activeDirectory.value.trim() !== directory) return;
    const next = Array.from(new Set(collected)).sort((a, b) => a.localeCompare(b));
    const changed =
      next.length !== files.value.length || next.some((path, index) => path !== files.value[index]);
    if (!changed) return;
    files.value = next;
    fileCacheVersion.value += 1;
  } catch {
    // Root listing is already visible; keep it if the background scan fails.
  }
}

async function reloadTree() {
  await rebuildFileCache();
}

let fileTreeWatchBound = false;

function initializeFileTree(options: UseFileTreeOptions) {
  boundOptions = options;
  if (fileTreeWatchBound) return;
  fileTreeWatchBound = true;
  usePtyOneshot({ activeDirectory: options.activeDirectory });
  watch(
    () => getOptions().activeDirectory.value,
    (directory, previous) => {
      const activePath = directory.trim();
      const previousPath = (previous ?? '').trim();
      if (
        activePath &&
        previousPath &&
        normalizeDirectory(activePath) === normalizeDirectory(previousPath)
      ) {
        return;
      }

      clearScheduledDirectoryReloads();

      treeNodes.value = [];
      expandedTreePathSet.value = new Set();
      selectedTreePath.value = '';
      treeError.value = '';
      files.value = [];
      fileCacheVersion.value += 1;
      setGitStatus(null);
      branchEntries.value = [];

      if (!activePath) {
        treeLoading.value = false;
        return;
      }
      void reloadTree();
    },
    { immediate: true },
  );
}

export function useFileTree(options?: UseFileTreeOptions) {
  if (options) initializeFileTree(options);
  if (!boundOptions) {
    throw new Error('useFileTree is not initialized');
  }

  return {
    treeNodes,
    expandedTreePaths,
    expandedTreePathSet,
    selectedTreePath,
    treeLoading,
    treeError,
    gitStatus,
    gitStatusByPath,
    gitStatusLoading,
    files,
    fileCacheVersion,
    reloadTree,
    refreshGitStatus,
    toggleTreeDirectory,
    selectTreeFile,
    feed,
    branchEntries,
    branchListLoading,
    refreshBranchEntries,
  };
}
