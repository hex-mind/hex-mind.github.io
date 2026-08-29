import * as opencodeApi from './opencode';

export type PickDirectoryResult =
  | { status: 'cancelled' }
  | { status: 'resolved'; path: string }
  | { status: 'unresolved'; hint: string; folderName: string };

type FileWithPath = File & { path?: string };

const COMMON_PARENT_NAMES = [
  'Downloads',
  'Documents',
  'Desktop',
  'Projects',
  'Developer',
  'code',
  'src',
  'work',
  'repos',
];

/**
 * Open a native folder picker (same mechanism as attaching files) and resolve
 * the chosen folder to an absolute filesystem path for OpenCode.
 *
 * `input.click()` runs synchronously so this must be called from a user gesture.
 */
export function pickLocalDirectory(
  options: { homePath?: string } = {},
): Promise<PickDirectoryResult> {
  return pickWithFileInput(options.homePath);
}

function pickWithFileInput(homePath?: string): Promise<PickDirectoryResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.width = '0';
    input.style.height = '0';
    input.tabIndex = -1;

    let settled = false;
    const finish = (result: PickDirectoryResult) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(result);
    };

    input.addEventListener('cancel', () => finish({ status: 'cancelled' }));
    input.addEventListener('change', () => {
      const files = input.files ? Array.from(input.files) : [];
      if (files.length === 0) {
        finish({ status: 'cancelled' });
        return;
      }
      void resolveFromFiles(files, homePath).then(finish);
    });

    document.body.appendChild(input);
    input.click();
  });
}

async function resolveFromFiles(files: File[], homePath?: string): Promise<PickDirectoryResult> {
  const first = files[0] as FileWithPath | undefined;
  if (!first) return { status: 'cancelled' };

  const native = directoryFromNativeFilePath(first);
  if (native) return { status: 'resolved', path: native };

  const folderName = folderNameFromFiles(files);
  if (!folderName) return { status: 'cancelled' };

  // No trailing slash: the picker treats `~/name` as home + filter, not a missing directory.
  const hint = homePath ? `~/${folderName}` : folderName;
  const sampleRel = sampleInnerRelative(files);
  const resolved = await resolveFolderName(folderName, homePath, sampleRel);
  if (resolved) return { status: 'resolved', path: resolved };
  return { status: 'unresolved', hint, folderName };
}

function folderNameFromFiles(files: File[]): string {
  const rel = files[0]?.webkitRelativePath?.replace(/\\/g, '/') ?? '';
  const name = rel.split('/')[0]?.trim();
  return name || files[0]?.name?.trim() || '';
}

function sampleInnerRelative(files: File[]): string {
  const paths = files
    .slice(0, 40)
    .map((file) => {
      const rel = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
      const slash = rel.indexOf('/');
      return slash >= 0 ? rel.slice(slash + 1) : '';
    })
    .filter(Boolean)
    .sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
  return paths[0] ?? '';
}

function directoryFromNativeFilePath(file: FileWithPath): string | null {
  const abs = typeof file.path === 'string' ? file.path.replace(/\\/g, '/').trim() : '';
  if (!abs.startsWith('/')) return null;

  const rel = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
  const folder = rel.split('/')[0];
  if (folder && abs.includes(`/${rel}`)) {
    const rootEnd = abs.lastIndexOf(`/${rel}`);
    return `${abs.slice(0, rootEnd)}/${folder}`;
  }

  let dir = abs.replace(/\/+$/, '');
  const segments = rel.split('/').filter(Boolean);
  for (let i = 0; i < segments.length; i += 1) {
    const lastSlash = dir.lastIndexOf('/');
    if (lastSlash <= 0) break;
    dir = dir.slice(0, lastSlash);
  }
  return dir || null;
}

async function resolveFolderName(
  folderName: string,
  homePath?: string,
  sampleRel?: string,
): Promise<string | null> {
  const home = (homePath ?? '').replace(/\/+$/, '');
  const candidates = new Set<string>();

  if (home) {
    candidates.add(joinPath(home, folderName));
    for (const parent of COMMON_PARENT_NAMES) {
      candidates.add(joinPath(home, parent, folderName));
    }
    try {
      const found = await opencodeApi.findFiles({
        directory: home,
        query: folderName,
        type: 'directory',
        limit: 50,
      });
      if (Array.isArray(found)) {
        for (const entry of found) {
          if (typeof entry !== 'string') continue;
          const relative = entry.replace(/\/+$/, '');
          if (basename(relative) !== folderName) continue;
          candidates.add(joinPath(home, relative));
        }
      }
    } catch {
      // Index may be unavailable; keep local candidates.
    }
  }

  try {
    const projects = await opencodeApi.listProjects();
    if (Array.isArray(projects)) {
      for (const project of projects) {
        if (!project || typeof project !== 'object') continue;
        const worktree = (project as { worktree?: unknown }).worktree;
        if (typeof worktree !== 'string') continue;
        const path = worktree.replace(/\/+$/, '');
        if (basename(path) === folderName) candidates.add(path);
      }
    }
  } catch {
    // Opening a brand-new folder should still work without project history.
  }

  const verified: string[] = [];
  for (const candidate of candidates) {
    if (await parentContains(parentDir(candidate), basename(candidate), homePath)) {
      verified.push(candidate);
    }
  }
  if (verified.length === 0) return null;
  if (sampleRel) {
    const withSample = [];
    for (const dir of verified) {
      if (await containsRelative(dir, sampleRel, homePath)) withSample.push(dir);
    }
    if (withSample.length === 1) return withSample[0];
    if (withSample.length > 1) {
      return withSample.slice().sort((a, b) => b.length - a.length)[0];
    }
  }
  return verified.slice().sort((a, b) => b.length - a.length)[0] ?? null;
}

async function listEntries(absoluteDir: string, homePath?: string): Promise<unknown[]> {
  try {
    const data = await opencodeApi.listFilesAt(absoluteDir, homePath);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function isNamedDirectory(entry: unknown, name: string): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const record = entry as { name?: unknown; type?: unknown };
  return record.name === name && record.type !== 'file';
}

async function parentContains(parent: string, name: string, homePath?: string): Promise<boolean> {
  if (!name) return false;
  const entries = await listEntries(parent, homePath);
  return entries.some((entry) => isNamedDirectory(entry, name));
}

async function containsRelative(
  directory: string,
  relPath: string,
  homePath?: string,
): Promise<boolean> {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) return true;
  const parts = normalized.split('/');
  const name = parts.pop();
  if (!name) return true;
  const parent = parts.length > 0 ? joinPath(directory, ...parts) : directory;
  return parentContains(parent, name, homePath);
}

function parentDir(path: string): string {
  const clean = path.replace(/\/+$/, '') || '/';
  const index = clean.lastIndexOf('/');
  return index <= 0 ? '/' : clean.slice(0, index);
}

function joinPath(...parts: string[]): string {
  const cleaned = parts
    .map((part) => part.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${cleaned.join('/')}`;
}

function basename(path: string): string {
  const clean = path.replace(/\/+$/, '');
  return clean.split('/').pop() || clean;
}
