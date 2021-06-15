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
  INSERT INTO forums as f (title, "user", slug) VALUES
  ($1, (SELECT nickname FROM users WHERE nickname = $2), $3)
  RETURNING title, "user", slug, threads, 0 as posts`;

  private static extractInfoSQL = `
  SELECT f.title, f.slug, f.user, f.threads, count(p.id) as posts
  FROM forums as f
  LEFT JOIN threads t on f.slug = t.forum_slug
  LEFT JOIN posts p on p.thread_id = t.id
  WHERE f.slug = $1
  GROUP BY f.title, f.slug, f.user, f.threads`;

  private static makeThreadsSQL(params: IGetParams) {
    return `
      SELECT t.id, t.title, t.author, t.forum_slug as forum, t.message, t.votes, t.slug, t.created
      FROM threads as t
      JOIN forums as f on t.forum_slug = f.slug
      WHERE f.slug = $1 ${params.since ? `AND t.created ${params.desc ? '<=' : '>='} $3` : ''}
      ORDER BY created ${params.desc ? 'DESC' : 'ASC'}
      LIMIT $2`;
  }

  static createForum(forumInfo: IForumCreationInfo) {
    return database.pool.connect().then((client) => client
      .query(this.createForumSQL, [forumInfo.title, forumInfo.user, forumInfo.slug])
      .then((res) => ({ result: res.rows[0], status: 'ok' }))
      .catch((err) => {
        if (!err.detail.includes('already exists')) {
          return ({ status: 'not-found', result: {} });
        }

        return this.extractForumInfo(client, forumInfo.slug, 'conflict');
      })
      .finally(() => client.release()));
  }

  static getForumInfo(slug: string) {
    return database.pool.connect().then((client) => this.extractForumInfo(client, slug, 'ok')
      .then((res) => (!res.result ? ({
        result: {},
        status: 'not-found',
      }) : res))
      .catch((err) => ({
        result: {},
        status: 'not-found',
      }))
      .finally(() => client.release()));
  }

  static getForumThreads(forumSlug: string, params: IGetParams) {
    return database.pool.connect().then((client) => {
      const sql = this.makeThreadsSQL(params);
      const attrs = [forumSlug, params.limit];
      if (params.since) {
        attrs.push(params.since);
      }

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
