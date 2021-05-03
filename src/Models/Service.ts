import { Model } from './Model.js';
import { database } from '../modules/db/db-connector.js';

export class Service extends Model {
  private static statusSQL = `
    SELECT 'user' as users, count(*) from users
    UNION
    SELECT 'forum' as forums, count(*) from forums
    UNION
    SELECT 'thread' as threads, count(*) from threads
    UNION
    SELECT 'post' as posts, count(*) from posts`;

  static getStatus() {
    return database.pool.connect().then((client) => client
      .query(this.statusSQL)
      .then((res) => {
        const result = res.rows.reduce((previous, current) => {
          previous[current.users] = Number(current.count);

          return previous;
        }, {});

        return ({ result, status: 'ok' });
      })
      .finally(() => client.release()));
  }

  static clearAll() {
    const clearAllSQL = `
      TRUNCATE users CASCADE;
      TRUNCATE forums CASCADE;
      TRUNCATE threads CASCADE;
      TRUNCATE posts CASCADE;
      TRUNCATE votes CASCADE;
      ALTER SEQUENCE users_id_seq RESTART WITH 1;
      ALTER SEQUENCE threads_id_seq RESTART WITH 1;
      ALTER SEQUENCE forums_id_seq RESTART WITH 1;
      ALTER SEQUENCE posts_id_seq RESTART WITH 1;
    `;

    return database.pool.connect().then((client) => client
      .query(clearAllSQL)
      .then((res) => ({ status: 'ok' }))
      .finally(() => client.release()));
  }
}
