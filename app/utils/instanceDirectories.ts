import { normalizeDirectory } from './path';
import { StorageKeys, storageGetJSON, storageSetJSON } from './storageKeys';

const MAX_DIRECTORIES = 80;

function isPersistableDirectory(value: string) {
  return Boolean(value) && value !== '/';
}

export function readInstanceDirectories(): string[] {
  const raw = storageGetJSON<unknown>(StorageKeys.state.instanceDirectories);
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const directories: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const directory = normalizeDirectory(entry);
    if (!isPersistableDirectory(directory) || seen.has(directory)) continue;
    seen.add(directory);
    directories.push(directory);
  }
  return directories;
}

export function rememberInstanceDirectories(directories: Iterable<string>): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const entry of [...directories, ...readInstanceDirectories()]) {
    const directory = normalizeDirectory(entry);
    if (!isPersistableDirectory(directory) || seen.has(directory)) continue;
    seen.add(directory);
    next.push(directory);
    if (next.length >= MAX_DIRECTORIES) break;
  }
  storageSetJSON(StorageKeys.state.instanceDirectories, next);
  return next;
}
