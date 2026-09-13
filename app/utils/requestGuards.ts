/** Small request/render helpers. Keep these pure so they can be checked without Vue. */

export function createLruMap<T>(limit: number) {
  const items = new Map<string, T>();

  function get(key: string): T | undefined {
    const value = items.get(key);
    if (value === undefined) return undefined;
    items.delete(key);
    items.set(key, value);
    return value;
  }

  function set(key: string, value: T) {
    if (items.has(key)) items.delete(key);
    items.set(key, value);
    while (items.size > limit) {
      const oldest = items.keys().next().value;
      if (oldest === undefined) break;
      items.delete(oldest);
    }
  }

  function drop(key: string) {
    items.delete(key);
  }

  return {
    get,
    set,
    drop,
    get size() {
      return items.size;
    },
  };
}

export function addedKeys(previous: Iterable<string>, next: Iterable<string>): string[] {
  const seen = new Set(previous);
  const added: string[] = [];
  for (const key of next) {
    if (seen.has(key)) continue;
    added.push(key);
  }
  return added;
}

export function historyCacheKey(sessionId: string, directory: string): string {
  return `${directory}\0${sessionId}`;
}
