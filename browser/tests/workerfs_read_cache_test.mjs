// Run: node browser/tests/workerfs_read_cache_test.mjs
import assert from 'node:assert/strict';
import { cacheWorkerFSReads } from '../web/workerfs_read_cache.js';

const blockSize = 256 * 1024;
const valueAt = (node, position) => (position * 17 + Math.floor(position / 251) + node.salt) % 256;
const reads = [];
let failure = null;
const workerFS = { stream_ops: {
  read({ node }, buffer, offset, length, position) {
    if (failure) throw failure;
    const count = Math.max(0, Math.min(length, node.size - position));
    reads.push({ node, position, count });
    for (let i = 0; i < count; ++i) buffer[offset + i] = valueAt(node, position + i);
    return count;
  },
} };
const clear = cacheWorkerFSReads(workerFS);
const node = { size: 5 * blockSize + 37, salt: 3 };
function checkRead(node, position, length) {
  const buffer = new Uint8Array(length + 14).fill(0xfa);
  const count = workerFS.stream_ops.read({ node }, buffer, 7, length, position);
  const expected = Math.max(0, Math.min(length, node.size - position));
  assert.equal(count, expected);
  const data = Uint8Array.from({ length: count }, (_, i) => valueAt(node, position + i));
  assert.deepEqual(buffer.subarray(7, 7 + count), data);
  assert.ok(buffer.subarray(0, 7).every((b) => b === 0xfa));
  assert.ok(buffer.subarray(7 + count).every((b) => b === 0xfa), 'read only changes the requested output range');
}

// C/C++-sized reads hit one browser read per block, including when a file
// is reopened (a different stream with the same node).
for (let at = 0; at < 2 * blockSize; at += 1024) checkRead(node, at, 1024);
assert.equal(reads.length, 2, '512 small reads coalesce into two browser reads');
checkRead(node, blockSize + 10, 17);
assert.equal(reads.length, 2, 'a backward seek within the cached block is a hit');

// Crossing blocks, large reads, seeking to an earlier block, short EOF,
// exact EOF, and an empty read/file must all preserve FS.read semantics.
checkRead(node, 2 * blockSize - 11, 29);
checkRead(node, blockSize - 3, 3 * blockSize + 17);
checkRead(node, 100, 500);
checkRead(node, node.size - 9, 100);
const beforeEOF = reads.length;
checkRead(node, node.size, 100);
checkRead(node, node.size + 50, 100);
checkRead(node, 0, 0);
checkRead({ size: 0, salt: 0 }, 0, 3);
assert.equal(reads.length, beforeEOF);
assert.ok(reads.every((r) => r.count <= blockSize), 'read-ahead never allocates a whole large file');

// Large archives must not truncate offsets through 32-bit bitwise math.
checkRead({ size: 2 ** 32 + 123, salt: 11 }, 2 ** 32 - 15, 100);

// Independent files never share bytes. LRU eviction bounds retained data
// even when an archive contains thousands of files.
clear();
const nodes = Array.from({ length: 17 }, (_, salt) => ({ size: blockSize, salt }));
for (const n of nodes.slice(0, 16)) checkRead(n, 0, 32);
const beforeHits = reads.length;
checkRead(nodes[0], 0, 32); // touch the oldest file, keeping it in the cache
assert.equal(reads.length, beforeHits);
checkRead(nodes[16], 0, 32); // evicts node 1
checkRead(nodes[0], 0, 32);
assert.equal(reads.length, beforeHits + 1);
checkRead(nodes[1], 0, 32);
assert.equal(reads.length, beforeHits + 2, 'least recently used file was evicted');

// Clearing between mounts releases old nodes and forces a new browser read.
clear();
const beforeClear = reads.length;
checkRead(nodes[1], 0, 32);
assert.equal(reads.length, beforeClear + 1);

// A browser I/O error reaches the importer; failed reads aren't cached.
clear();
failure = new Error('file permission lost');
assert.throws(() => checkRead(node, 0, 32), /file permission lost/);
failure = null;
checkRead(node, 0, 32);

console.log('PASS: buffered WORKERFS reads, seeks, EOF, large offsets, eviction and errors');
