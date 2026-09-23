/**
 * AWS Lambda entry (API Gateway HTTP API proxy).
 *
 * On the first invocation (cold start) it lazily:
 *   1. resolves secrets (DB creds + JWT) from Secrets Manager, and
 *   2. runs idempotent migrations + seed-if-empty,
 * so the very first request already has a working schema and an admin login.
 */
import { handle } from 'hono/aws-lambda';
import { app } from './app.js';

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  // Resolve JWT secret (Lambda cannot inject Secrets Manager values as env safely)
  if (!process.env.JWT_SECRET && process.env.JWT_SECRET_ARN) {
    process.env.JWT_SECRET = await getSecretString(process.env.JWT_SECRET_ARN);
  }
  // db/index.ts reads DB_SECRET_ARN itself when building the pg pool.
  const { runMigrations } = await import('./db/index.js');
  await runMigrations();
  const { seed } = await import('./seed.js');
  await seed();
}

async function getSecretString(arn: string): Promise<string> {
  const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
  const client = new SecretsManagerClient({});
  const res = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  return res.SecretString ?? '';
}

const honoHandler = handle(app);

export const handler = async (event: any, context: any) => {
  if (!ready) ready = init().catch((e) => { ready = null; throw e; });
  await ready;
  return honoHandler(event, context);
};
