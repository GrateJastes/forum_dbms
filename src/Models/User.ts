import { PoolClient } from 'pg';
import { IGetParams, Model } from './Model.js';
import { database } from '../modules/db/db-connector.js';

export interface IUserProfileInfo {
  fullname?: string,
  about?: string,
  email?: string,
}

export class User extends Model {
  private static makeForumUsersSQL(params: IGetParams) {
    return `
      SELECT u.nickname, u.fullname, u.about, u.email
      FROM threads t
      JOIN forums f on t.forum_slug = f.slug and f.slug = $1
      LEFT JOIN posts p on t.id = p.thread_id
      JOIN users u on t.author = u.nickname or p.author = u.nickname
      ${params.since ? `WHERE u.nickname ${params.desc ? '<' : '>'} $3 COLLATE "C"` : ''}
      GROUP BY u.nickname, u.fullname, u.about, u.email
      ORDER BY u.nickname COLLATE "C" ${params.desc ? 'DESC' : ''}
      LIMIT $2`;
  }

  static createUser(profile: IUserProfileInfo, nickname: string) {
    return database.pool.connect().then((client: PoolClient) => client
      .query(
        'INSERT INTO users (nickname, fullname, about, email) VALUES ($1, $2, $3, $4) RETURNING nickname, fullname, about, email',
        [nickname, profile.fullname, profile.about, profile.email],
      )
      .then((result) => ({ result: result.rows[0], status: 'ok' }))
      .catch(() => client
        .query('SELECT nickname, fullname, about, email FROM users WHERE nickname = $1 or email = $2', [nickname, profile.email])
        .then((result) => ({ status: 'conflict', result: result.rows })))
      .finally(() => client.release()));
  }

  static getUser(nickname: string) {
    return database.pool.connect().then((client: PoolClient) => client
      .query('SELECT nickname, fullname, about, email FROM users WHERE nickname = $1', [nickname])
      .then((res) => (res.rows.length ? { status: 'ok', result: res.rows[0] } : { status: 'not-found', result: {} }))
      .catch((err) => ({ status: 'error', result: err }))
      .finally(() => client.release()));
  }

  static updateUserInfo(nickname: string, profile: IUserProfileInfo) {
    return database.pool.connect().then((client) => {
      const safeProfile: IUserProfileInfo = {};
      if (profile.email) {
        safeProfile.email = profile.email;
      }
      if (profile.about) {
        safeProfile.about = profile.about;
      }
      if (profile.fullname) {
        safeProfile.fullname = profile.fullname;
      }

      const propNames = Object.entries(safeProfile).map((prop) => prop[0]);
      const propValues = Object.entries(safeProfile).map((prop) => prop[1]);

      if (!propNames.length) {
        return client
          .query(`SELECT nickname, fullname, about, email FROM users WHERE nickname = $1`, [nickname])
          .then((res) => ({ result: res.rows[0], status: 'ok' }))
          .catch((err) => ({ status: 'error', result: err })) // Was not-found
          .finally(() => client.release());
      }

      const updateValsSQL = `
      ${propNames.length > 1 ? '(' : ''} ${propNames} ${propNames.length > 1 ? ')' : ''} =
      ${propNames.length > 1 ? '(' : ''} ${propNames.map((val, i) => `$${i + 2}`)} ${propNames.length > 1 ? ')' : ''}`;

      return client
        .query(`UPDATE users SET ${updateValsSQL} WHERE nickname = $1 RETURNING nickname, fullname, about, email`, [nickname, ...propValues])
        .then((result) => (result.rows.length ? { status: 'ok', result: result.rows[0] } : { status: 'not-found', result: {} }))
        .catch(() => ({ status: 'conflict', result: {} }))
        .finally(() => client.release());
    });
  }

  static getForumUsers(forumSlug: string, params: IGetParams) {
    const searchValues = [forumSlug, params.limit];
    if (params.since) {
      searchValues.push(params.since);
    }

    return database.pool.connect().then((client) => client
      .query(this.makeForumUsersSQL(params), searchValues)
      .then((res) => {
        if (res.rows.length) {
          return ({
            result: res.rows,
            status: 'ok',
          });
        }

        return client.query('SELECT slug FROM forums WHERE slug = $1', [forumSlug]).then((res) => {
          if (res.rows.length) {
            return ({ result: [], status: 'ok' });
          }

          return ({ result: {}, status: 'not-found' });
        });
      })
      .catch((err) => ({ result: err, status: 'err' }))
      .finally(() => client.release()));
  }
}
