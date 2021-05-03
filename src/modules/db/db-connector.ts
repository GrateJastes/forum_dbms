import pkg, { PoolClient } from 'pg';

const { Pool } = pkg;

export class PgDb {
  public pool;

  constructor() {
    const pool = new Pool();
    pool.on('error', (err: Error, client : PoolClient) => {
      // eslint-disable-next-line no-console
      console.log('Unexpected error on idle client', err);
      process.exit(1);
    });

    this.pool = pool;
  }
}

export const database = new PgDb();
