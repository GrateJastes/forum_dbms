import { PoolClient } from 'pg';
import { IGetParams, Model } from './Model.js';
import { database } from '../modules/db/db-connector.js';

export interface IUserProfileInfo {
  fullname: string,
  about: string,
  email: string,
}

export class User extends Model {
  private static makeForumUsersSQL(params: IGetParams) {
    return `
      SELECT u.nickname, u.fullname, u.about, u.email
      FROM threads t
      JOIN forums f on t.forum_id = f.id and f.slug = $1
      LEFT JOIN posts p on t.id = p.thread_id
      JOIN users u on (t.author_id = u.id or p.author_id = u.id) ${params.since ? `AND u.nickname ${params.desc ? '<' : '>'} $2 COLLATE "C"` : ''}
      GROUP BY u.nickname, u.fullname, u.about, u.email
      ORDER BY u.nickname COLLATE "C" ${params.desc ? 'DESC' : ''}
      LIMIT ${params.since ? '$3' : '$2'}
    `;
  }

  static createUser(profile: IUserProfileInfo, nickname: string) {
    return database.pool.connect().then((client: PoolClient) => client
      .query(
        'INSERT INTO users (nickname, fullname, about, email) VALUES ($1, $2, $3, $4) RETURNING *',
        [nickname, profile.fullname, profile.about, profile.email],
      )
      .then((result) => {
        const userInfo = result.rows[0];
        delete userInfo.id;
        return ({
          result: userInfo,
          status: 'ok',
        });
      })
      .catch((err) => client
        .query('SELECT * FROM users WHERE nickname=$1 or email=$2', [nickname, profile.email])
        .then((result) => ({
          status: 'conflict',
          result: result.rows.map((row) => {
            delete row.id;
            return row;
          }),
        })))
      .finally(() => client.release()));
  }

  static getUser(nickname: string) {
    return database.pool.connect().then((client: PoolClient) => client
      .query('SELECT nickname, fullname, about, email FROM users WHERE nickname=$1', [nickname])
      .then((result) => (result.rows.length ? { status: 'ok', result: result.rows[0] } : { status: 'not-found' }))
      .catch((err) => ({ status: 'error', result: {} }))
      .finally(() => client.release()));
  }

  static updateUserInfo(nickname: string, profile: IUserProfileInfo) {
    return database.pool.connect().then((client: PoolClient) => {
      const propNames = Object.entries(profile).map((prop) => prop[0]);
      const propValues = Object.entries(profile).map((prop) => prop[1]);
      if (!propNames.length) {
        return client
          .query(`SELECT nickname, fullname, about, email FROM users WHERE nickname = $1`, [nickname])
          .then((res) => ({ result: res.rows[0], status: 'ok' }))
          .catch((err) => ({ status: 'not-found', result: {} }))
          .finally(() => client.release());
      }

      const updateValsSQL = `
      ${propNames.length > 1 ? '(' : ''} ${propNames} ${propNames.length > 1 ? ')' : ''} =
      ${propNames.length > 1 ? '(' : ''} ${propNames.map((val, i) => `$${i + 2}`)} ${propNames.length > 1 ? ')' : ''}`;

      return client
        .query(
          `UPDATE users SET ${updateValsSQL} WHERE nickname = $1 RETURNING nickname, fullname, about, email`,
          [nickname, ...propValues],
        )
        .then((result) => (result.rows.length ? {
          status: 'ok',
          result: result.rows[0],
        } : { status: 'not-found', result: {} }))
        .catch((err) => ({ status: 'conflict', result: {} }))
        .finally(() => client.release());
    });
  }

  static getForumUsers(forumSlug: string, params: IGetParams) {
    const searchValues = [forumSlug];
    if (params.since) {
      searchValues.push(params.since);
    }
    searchValues.push(`${params.limit}`);

    return database.pool.connect().then((client) => client
      .query(this.makeForumUsersSQL(params), searchValues)
      .then((res) => {
        if (res.rows.length) {
          return ({
            result: res.rows,
            status: 'ok',
          });
        }

        return client.query('SELECT id FROM forums WHERE slug = $1', [forumSlug]).then((res) => {
          if (res.rows.length) {
            return ({ result: [], status: 'ok' });
          }
          return ({ result: {}, status: 'not-found' });
        });
      })
      .catch((err) => ({ result: {}, status: 'not-found' }))
      .finally(() => client.release()));
  }
}
