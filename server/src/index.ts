/** Local dev entry: run migrations then serve the Hono app on Node. */
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './app.js';
import { runMigrations } from './db/index.js';

const port = Number(process.env.PORT ?? 4000);
await runMigrations();
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Sati API listening on http://localhost:${info.port}`);
});
