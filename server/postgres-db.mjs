import pg from 'pg';

// The game uses a small prepared-statement interface in both local and hosted mode.
export function createPostgresDB(pool) {
  return {
    prepare(sql) {
      let index = 0;
      const text = sql.replace(/\?/g, () => `$${++index}`);
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() {
          const result = await pool.query(text, values);
          const row = result.rows[0] || null;
          // PostgreSQL returns COUNT and bigint timestamps as strings.
          if (row) for (const key of ['total', 'last_seen', 'created_at', 'updated_at']) {
            if (key in row) row[key] = Number(row[key]);
          }
          return row;
        },
        async run(client = pool) {
          const result = await client.query(text, values);
          return { meta: { changes: result.rowCount } };
        },
      };
    },
    async batch(statements) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const results = [];
        for (const statement of statements) results.push(await statement.run(client));
        await client.query('COMMIT');
        return results;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  };
}

let database;
export function getHostedDB() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) return null;
  if (!database) {
    const pool = new pg.Pool({ connectionString, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 });
    pool.on('error', error => console.error('Database connection failed', error.code));
    database = createPostgresDB(pool);
  }
  return database;
}
