#!/usr/bin/env node
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { join } from 'node:path';
import { proxy } from 'hono/proxy';

const app = new Hono();

if (process.argv[2] === 'proxy') {
  const baseURL = process.argv[3] ?? 'https://hex-mind.github.io/hex';

  console.log('Proxy to ' + baseURL);

  app.use('*', (c) => {
    const url = new URL(baseURL);
    url.pathname = url.pathname.replace(/\/$/, '') + c.req.path;

    const q = c.req.queries();
    for (const k in q) {
      for (const v of q?.[k] ?? []) {
        url.searchParams.append(k, v);
      }
    }

    return proxy(url, {
      ...c.req,
    });
  });
} else {
  app.use('*', serveStatic({ root: join(import.meta.dirname, 'dist/') }));
}

serve(
  {
    fetch: app.fetch,
    port: process.env.HEX_PORT || 3000,
  },
  (info) => {
    console.log(`Listening on http://localhost:${info.port}`);
  },
);
