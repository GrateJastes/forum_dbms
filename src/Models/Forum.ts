import { PoolClient } from 'pg';
import { IGetParams, Model } from './Model.js';
import { database } from '../modules/db/db-connector.js';

export interface IForumCreationInfo {
  title: string;
  user: string;
  slug: string;
}

export class Forum extends Model {
  private static createForumSQL = `
  INSERT INTO forums as f (title, user_id, slug) VALUES
  (
      $1,
      (SELECT id from users where nickname = $2),
      $3
  ) 
  RETURNING slug
  `;

  private static extractInfoSQL = `
  SELECT f.title, f.slug, u.nickname as user, f.threads, count(p.id) as posts
  FROM forums as f
  JOIN users u on u.id = f.user_id and f.slug=$1
  LEFT JOIN threads t on f.id = t.forum_id
  LEFT JOIN posts p on p.thread_id = t.id
  GROUP BY f.title, f.slug, u.nickname, f.threads`;

  private static makeThreadsSQL(params: IGetParams) {
    return `
      SELECT t.id, t.title, u.nickname as author, f.slug as forum, t.message, t.votes, t.slug as slug, t.created
      FROM threads as t
      JOIN users as u on u.id = t.author_id
      JOIN forums as f on t.forum_id = f.id
      WHERE f.slug = $1 ${params.since ? `AND t.created ${params.desc ? '<=' : '>='} $2` : ''}
      ORDER BY created ${params.desc ? 'DESC' : 'ASC'}
      LIMIT ${params.since ? '$3' : '$2'}
    `;
  }

  static createForum(forumInfo: IForumCreationInfo) {
    return database.pool.connect().then((client) => client
      .query(this.createForumSQL, [forumInfo.title, forumInfo.user, forumInfo.slug])
      .then((res) => this.extractForumInfo(client, res.rows[0].slug, 'ok'))
      .catch((err) => {
        if (!err.detail.includes('already exists')) return ({ status: 'not-found', result: {} });
        return this.extractForumInfo(client, forumInfo.slug, 'conflict');
      })
      .finally(() => client.release()));
  }

  static getForumInfo(slug: string) {
    return database.pool.connect().then((client) => this.extractForumInfo(client, slug, 'ok')
      .catch((err) => ({
        result: {},
        status: 'not-found',
      }))
      .finally(() => client.release()));
  }

  static getForumThreads(forumSlug: string, params: IGetParams) {
    return database.pool.connect().then((client) => {
      const sql = this.makeThreadsSQL(params);
      const attrs = [forumSlug];
      if (params.since) {
        attrs.push(params.since);
      }
      attrs.push(`${params.limit}`);

      return client
        .query(sql, attrs)
        .then((res) => {
          if (!res.rows.length) {
            return client
              .query('SELECT slug FROM forums WHERE slug = $1', [forumSlug])
              .then((res) => (res.rows.length ? ({ result: [], status: 'ok' }) : ({ result: {}, status: 'not-found' })));
          }

          return ({
            result: res.rows,
            status: 'ok',
          });
        })
        .catch((err) => ({
          result: {},
          status: 'not-found',
        }))
        .finally(() => client.release());
    });
  }

  private static extractForumInfo(client: PoolClient, slug: string, status: string) {
    return client
      .query(this.extractInfoSQL, [slug])
      .then((res) => {
        const resultInfo = res.rows[0];
        resultInfo.posts = Number(resultInfo.posts);
        return ({
          result: resultInfo,
          status,
        });
      });
  }
}
