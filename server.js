#!/usr/bin/env node
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = join(import.meta.dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  try {
    // WHATWG URL normalizes literal ".." away, but decodeURIComponent can
    // re-introduce it (%2e%2e%2f) — so the ".." check must run after decoding.
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    if (/(?:^|[/\\])\.\.(?:$|[/\\])/.test(path)) {
      res.writeHead(403).end();
      return;
    }
    let file = join(root, path);
    let stats = statSync(file, { throwIfNoEntry: false });
    if (stats?.isDirectory()) {
      file = join(file, 'index.html');
      stats = statSync(file, { throwIfNoEntry: false });
    }
    if (!stats?.isFile()) {
      res.writeHead(404).end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Content-Length': stats.size,
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch {
    // Malformed input (bad %encoding, null bytes, …) — reject, never crash.
    if (!res.headersSent) res.writeHead(400);
    res.end();
  }
});

const port = process.env.HEX_PORT || 3000;
server.listen(port, () => {
  console.log(`Listening on http://localhost:${server.address().port}`);
});
