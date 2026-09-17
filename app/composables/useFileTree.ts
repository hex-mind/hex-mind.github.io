import { computed, ref, watch } from 'vue';
import type { Ref } from 'vue';
import type { FileWatcherUpdatedPacket } from '../types/sse';
import * as opencodeApi from '../utils/opencode';
import {
  GIT_COMMON_ARGS,
  decodeUtf8Mojibake,
  parseGitBranchList,
  parseGitStatusOutput,
  type GitBranchInfo,
  type GitDiffStats,
  type GitFileStatus,
} from '../utils/gitStatus';
import { normalizeDirectory } from '../utils/path';
import { usePtyOneshot } from './usePtyOneshot';

export type {
  GitBranchInfo,
  GitDiffStats,
  GitDiffStatsEntry,
  GitFileStatus,
  GitStatusCode,
} from '../utils/gitStatus';

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

type GitStatus = {
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
const branchEntries = ref<BranchEntry[]>([]);
const branchListLoading = ref(false);

let fileCacheBuildId = 0;
const DIRECTORY_RELOAD_DEBOUNCE_MS = 120;
const AUTO_SCAN_FILE_LIMIT = 1000;
const AUTO_SCAN_DIR_LIMIT = 64;
const SKIP_BACKGROUND_DIR_NAMES = new Set([
  '.git',
  '.svn',
  '.hg',
  '.cache',
  '.Trash',
  'node_modules',
  'Library',
  'System',
  'Applications',
  'Volumes',
  'private',
  'proc',
  'dev',
  'sys',
]);
const scheduledDirectoryReloads = new Map<string, ReturnType<typeof setTimeout>>();
let gitStatusGeneration = 0;
let branchListGeneration = 0;

function getOptions(): UseFileTreeOptions {
  if (!boundOptions) {
    throw new Error('useFileTree must be initialized with options before use');
  }
  return boundOptions;
}

function withForwardSlashes(value: string) {
  return value.replace(/\\/g, '/');
}

function normalizeRelativePath(path: string) {
  const trimmed = withForwardSlashes(path).trim();
  if (!trimmed || trimmed === '.') return '.';
  const withoutPrefix = trimmed
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .replace(/^(\.\.\/)+/, '');
  const normalized = withoutPrefix.replace(/\/+/g, '/').replace(/\/$/, '');
  return normalized || '.';
}

function toRelativePath(path: string, directory: string) {
  const normalizedDirectory = withForwardSlashes(normalizeDirectory(directory));
  const normalizedPath = withForwardSlashes(normalizeDirectory(path));
  if (normalizedPath === normalizedDirectory) return '.';
  const prefix = `${normalizedDirectory}/`;
  const relative = normalizedPath.startsWith(prefix)
    ? normalizeRelativePath(normalizedPath.slice(prefix.length))
    : normalizeRelativePath(normalizedPath);
  return decodeUtf8Mojibake(relative);
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
  const name = decodeUtf8Mojibake(
    (typeof record.name === 'string' && record.name) ||
      (path === '.' ? '.' : path.split('/').at(-1)) ||
      path,
  );
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
  const normalizedDirectory = withForwardSlashes(normalizeDirectory(directory));
  const normalizedPath = withForwardSlashes(normalizeDirectory(path));
  if (!normalizedDirectory || !normalizedPath) return false;
  return (
    normalizedPath === normalizedDirectory || normalizedPath.startsWith(`${normalizedDirectory}/`)
  );
}

function parentDirectoryPath(relativePath: string) {
  if (!relativePath.includes('/')) return '.';
  return relativePath.slice(0, relativePath.lastIndexOf('/')) || '.';
}

function isFilesystemRoot(directory: string) {
  const normalized = normalizeDirectory(directory.trim());
  return !normalized || normalized === '/';
}

function shouldSkipBackgroundDirectory(node: TreeNode) {
  if (node.type !== 'directory' || node.ignored) return true;
  return SKIP_BACKGROUND_DIR_NAMES.has(node.name);
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

function runGit(args: string[]) {
  const { runOneShotPtyCommand } = usePtyOneshot();
  return runOneShotPtyCommand('git', [...GIT_COMMON_ARGS, ...args]);
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
  try {
    const statusOutput = await runGit(['status', '--porcelain=v1', '-b']);
    if (generation !== gitStatusGeneration) return;
    if (getOptions().activeDirectory.value.trim() !== directory) return;

    const parsed = parseGitStatusOutput(statusOutput);
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

    const [unstagedNumstat, stagedNumstat] = await Promise.all([
      runGit(['diff', '--numstat', '--shortstat']),
      runGit(['diff', '--cached', '--numstat', '--shortstat']),
    ]);
    if (generation !== gitStatusGeneration) return;
    if (getOptions().activeDirectory.value.trim() !== directory) return;

    const withStats = parseGitStatusOutput(statusOutput, unstagedNumstat, stagedNumstat);
    setGitStatus({
      branch: withStats.branch,
      files: withStats.files,
      diffStats: withStats.diffStats,
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

async function runGitOnPaths(args: string[], paths: string[]) {
  const unique = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
  if (!unique.length) return;
  await runGit([...args, '--', ...unique]);
  await refreshGitStatusOnly();
}

async function stagePaths(paths: string[]) {
  await runGitOnPaths(['add'], paths);
}

async function unstagePaths(paths: string[]) {
  await runGitOnPaths(['restore', '--staged'], paths);
}

function parseBranchEntries(output: string): BranchEntry[] {
  const entries: BranchEntry[] = parseGitBranchList(output).map((entry) => ({
    ...entry,
    hash: '',
    subject: '',
    upstream: '',
    hasLocalCounterpart: false,
  }));

  const localNames = new Set(
    entries.filter((entry) => entry.isLocal).map((entry) => entry.displayName),
  );
  for (const entry of entries) {
    if (!entry.isLocal) entry.hasLocalCounterpart = localNames.has(entry.displayName);
  }

  entries.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
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
  try {
    const output = await runGit([
      '-c',
      'color.branch=false',
      'branch',
      '--no-color',
      '-a',
      '--sort=-committerdate',
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
  if (!directory || isFilesystemRoot(directory)) return;
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
  if (!directory || isFilesystemRoot(directory)) {
    treeNodes.value = [];
    files.value = [];
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
    treeError.value = opencodeApi.formatDirectoryListError(error);
    treeLoading.value = false;
  }
}

async function scanFilesInBackground(directory: string, buildId: number, rootChildren: TreeNode[]) {
  if (isFilesystemRoot(directory)) return;

  const queue = rootChildren
    .filter((child) => !shouldSkipBackgroundDirectory(child))
    .map((child) => child.path);
  const visited = new Set<string>(['.']);
  const collected = files.value.slice();
  let listed = 0;

  try {
    while (queue.length > 0) {
      if (buildId !== fileCacheBuildId) return;
      if (getOptions().activeDirectory.value.trim() !== directory) return;
      if (listed >= AUTO_SCAN_DIR_LIMIT) break;
      const path = queue.shift();
      if (!path || visited.has(path)) continue;
      visited.add(path);

      let data: unknown;
      try {
        data = await opencodeApi.listFiles({ directory, path });
      } catch {
        // OpenCode returns 500 for missing/unreadable paths. Skip this folder.
        continue;
      }
      listed += 1;
      if (buildId !== fileCacheBuildId) return;
      const list = Array.isArray(data) ? data : [];
      const children = buildTreeNodes(list, directory, path);
      for (const child of children) {
        if (child.type === 'file') {
          collected.push(child.path);
          continue;
        }
        if (shouldSkipBackgroundDirectory(child) || visited.has(child.path)) continue;
        queue.push(child.path);
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
      setGitStatus(null);
      branchEntries.value = [];

      if (!activePath || isFilesystemRoot(activePath)) {
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
    reloadTree,
    refreshGitStatus,
    stagePaths,
    unstagePaths,
    toggleTreeDirectory,
    selectTreeFile,
    feed,
    branchEntries,
    branchListLoading,
    refreshBranchEntries,
  };
}
