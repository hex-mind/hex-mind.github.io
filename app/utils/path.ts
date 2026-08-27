/**
 * Normalize a relative path by stripping `.`, `..`, and empty segments.
 * Parent traversals (`..`) are silently dropped.
 */
export function normalizeRelativePathNoParent(value: string) {
  const segments = value.replace(/\\/g, '/').split('/');
  const cleaned: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..') continue;
    cleaned.push(segment);
  }
  return cleaned.join('/');
}

/**
 * Normalize an absolute path by resolving `.` / `..` segments.
 * The result always starts with `/`.
 */
export function normalizeAbsolutePathNoParent(value: string) {
  const segments = value.replace(/\\/g, '/').split('/');
  const cleaned: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (cleaned.length > 0) cleaned.pop();
      continue;
    }
    cleaned.push(segment);
  }
  return `/${cleaned.join('/')}`;
}

/**
 * Split a target path into `{ directory, path }` suitable for the `/file` and
 * `/file/content` API endpoints.
 *
 * When `sandboxDirectory` is provided, paths inside the sandbox are returned
 * relative to it (`directory = sandbox`).  Paths outside — or when
 * `sandboxDirectory` is `null` — are split at the first `/` so that the root
 * prefix becomes `directory` (e.g. `"/"` on POSIX, `"C:/"` on Windows).
 */
export function splitFileContentDirectoryAndPath(
  targetPath: string,
  sandboxDirectory: string | null,
): { directory: string; path: string } {
  const source = targetPath.replace(/\\/g, '/').trim();

  if (sandboxDirectory) {
    const sandbox = normalizeAbsolutePathNoParent(sandboxDirectory);

    if (!source) {
      return { directory: sandbox, path: '.' };
    }
    if (!source.startsWith('/')) {
      return { directory: sandbox, path: normalizeRelativePathNoParent(source) || '.' };
    }

    const absolute = normalizeAbsolutePathNoParent(source);
    if (absolute === sandbox) {
      return { directory: sandbox, path: '.' };
    }
    const prefix = `${sandbox}/`;
    if (absolute.startsWith(prefix)) {
      return { directory: sandbox, path: absolute.slice(prefix.length) || '.' };
    }
  }

  if (!source || !source.startsWith('/')) {
    const relative = source ? normalizeRelativePathNoParent(source) : '.';
    return { directory: '/', path: relative || '.' };
  }

  const absolute = normalizeAbsolutePathNoParent(source);
  const firstSlash = absolute.indexOf('/');
  const directory = absolute.slice(0, firstSlash + 1);
  const path = absolute.slice(firstSlash + 1);
  return { directory, path: path || '.' };
}
