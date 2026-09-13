import assert from 'node:assert/strict';
import { addedKeys, createLruMap, historyCacheKey } from './requestGuards.ts';

const cache = createLruMap<string>(2);
cache.set('a', 'A');
cache.set('b', 'B');
cache.set('c', 'C');
assert.equal(cache.size, 2);
assert.equal(cache.get('a'), undefined);
assert.equal(cache.get('b'), 'B');
cache.set('d', 'D');
assert.equal(cache.get('c'), undefined);
assert.equal(cache.get('b'), 'B');
assert.equal(cache.get('d'), 'D');

assert.deepEqual(addedKeys(['a', 'b'], ['b', 'c', 'a']), ['c']);
assert.deepEqual(addedKeys([], ['x']), ['x']);
assert.equal(historyCacheKey('s1', '/tmp'), '/tmp\0s1');

console.log('requestGuards.check: ok');
