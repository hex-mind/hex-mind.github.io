import { watch } from 'vue';

export function waitForState<T>(
  source: () => T,
  predicate: (value: T) => boolean,
  timeoutMs = 30_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const current = source();
    if (predicate(current)) {
      resolve(current);
      return;
    }

    let done = false;
    let stop = () => {};
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      stop();
      reject(new Error('Timed out waiting for state update.'));
    }, timeoutMs);

    stop = watch(
      source,
      (value) => {
        if (done) return;
        if (!predicate(value)) return;
        done = true;
        clearTimeout(timer);
        stop();
        resolve(value);
      },
      { deep: true },
    );
  });
}
