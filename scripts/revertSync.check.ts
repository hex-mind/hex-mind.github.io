import assert from 'node:assert/strict';
import { isRevertApplied, isUnrevertApplied } from '../app/utils/revertSync.ts';

assert.equal(isRevertApplied(undefined, 'msg-a'), false);
assert.equal(isRevertApplied('msg-a', 'msg-a'), true);
assert.equal(isRevertApplied('msg-a', 'msg-b'), true);
assert.equal(isRevertApplied('msg-a', 'msg-b', 'msg-a'), false);
assert.equal(isRevertApplied('msg-b', 'msg-b', 'msg-a'), true);
assert.equal(isRevertApplied('msg-c', 'msg-b', 'msg-a'), true);
assert.equal(isUnrevertApplied(undefined), true);
assert.equal(isUnrevertApplied(''), true);
assert.equal(isUnrevertApplied('msg-a'), false);

console.log('revertSync ok');
