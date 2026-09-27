import pg from 'pg';
import { readFile } from 'node:fs/promises';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) throw new Error('Falta DATABASE_URL o POSTGRES_URL. Connecta la base de dades a Vercel.');
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(await readFile(new URL('../db/postgres.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  console.log('Esquema PostgreSQL preparat.');
} finally { await client.end(); }
