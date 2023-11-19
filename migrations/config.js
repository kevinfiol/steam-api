import { postgres } from '../deps.ts';

const PG_SSL = Deno.env.get('PG_SSL') === 'true';
const PG_USERNAME = Deno.env.get('PG_USERNAME') || ''
const PG_PASSWORD = Deno.env.get('PG_PASSWORD') || ''
const PG_DB = Deno.env.get('PG_DB') || ''
const PG_HOST = Deno.env.get('PG_HOST') || ''
const PG_PORT = Deno.env.get('PG_PORT') || ''

export const sql = postgres({
  ssl: PG_SSL,
  keep_alive: false,
  host: PG_HOST,
  port: PG_PORT,
  database: PG_DB,
  username: PG_USERNAME,
  password: PG_PASSWORD
});