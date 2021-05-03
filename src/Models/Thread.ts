import { Model } from './Model.js';
import { database } from '../modules/db/db-connector.js';

export interface IThreadCreationInfo {
  title: string;
  author: string;
  message: string;
  created: string;
  slug: string;
}

export interface IThreadUpdateInfo {
  title: string;
  message: string;
}

export interface IVoteInfo {
  nickname: string;
  voice: number;
}

export class Thread extends Model {
  static threadExtractingSQL_slug = `
    SELECT t.id as id, t.title as title, u.nickname as author, f.slug as forum, t.message as message, t.votes as votes, t.slug as slug, t.created as created
    FROM threads t
    JOIN users u on t.author_id = u.id
    JOIN forums f on t.forum_id = f.id
    WHERE t.slug=$1
  `;
  static threadExtractingSQL_id = `
    SELECT t.id as id, t.title as title, u.nickname as author, f.slug as forum, t.message as message, t.votes as votes, t.slug as slug, t.created as created
    FROM threads t
    JOIN users u on t.author_id = u.id
    JOIN forums f on t.forum_id = f.id
    WHERE t.id=$1
  `;

  static createThread(forumSlug: string, threadInfo: IThreadCreationInfo) {
    const threadCreationSQL = `
    INSERT INTO threads as t (title, message, forum_id, author_id${threadInfo.created ? ', created' : ''}${threadInfo.slug ? ', slug' : ''}) VALUES
    (
        $3,
        $4,
        (SELECT id from forums f where f.slug = $1),
        (SELECT id from users u where u.nickname = $2)
        ${threadInfo.created ? ', $5' : ''}
        ${threadInfo.slug ? (threadInfo.created ? ', $6' : ', $5') : ''}
    )
    RETURNING t.id as id, t.title as title, t.message as message, t.votes as votes, t.slug as slug, t.created as created`;
    const threadCreationVals = [forumSlug, threadInfo.author, threadInfo.title, threadInfo.message];
    if (threadInfo.created) {
      threadCreationVals.push(threadInfo.created);
    }
    if (threadInfo.slug) {
      threadCreationVals.push(threadInfo.slug);
    }

    return database.pool.connect().then((client) => client
      .query('BEGIN')
      .then((res) => client
        .query(threadCreationSQL, threadCreationVals)
        .then((resultToCommit) => client
          .query(
            `UPDATE forums SET threads = threads + 1 WHERE slug = $1`,
            [forumSlug],
          )
          .then((res) => client.query('COMMIT')
            .then((res) => resultToCommit)))
        .then((mainResult) => client.query('SELECT slug FROM forums WHERE slug = $1', [forumSlug]).then((res) => {
          const result = mainResult.rows[0];
          result.forum = res.rows[0].slug;
          result.author = threadInfo.author;

          return ({ result, status: 'ok' });
        }))
        .catch((err) => {
          if (!err.detail.includes('already exists')) {
            return client.query('ROLLBACK').then((res) => ({ result: {}, status: 'not-found' }));
          }

          return client
            .query('ROLLBACK')
            .then((res) => client
              .query(this.threadExtractingSQL_slug, [threadInfo.slug])
              .then((res) => ({ result: res.rows[0], status: 'conflict' })));
        }))
      .finally(() => client.release()));
  }

  static getThreadInfo(slugOrID: string) {
    const isSlug = Number.isNaN(Number(slugOrID));
    const sql = isSlug ? this.threadExtractingSQL_slug : this.threadExtractingSQL_id;

    return database.pool.connect().then((client) => client
      .query(sql, [slugOrID])
      .then((res) => ({ result: res.rows[0], status: res.rows.length ? 'ok' : 'not-found' }))
      .catch((err) => ({ result: {}, status: 'error' }))
      .finally(() => client.release()));
  }

  static updateThreadInfo(slugOrID: string, updateInfo: IThreadUpdateInfo) {
    const isSlug = Number.isNaN(Number(slugOrID));
    const propNames = Object.entries(updateInfo).map((prop) => prop[0]);
    const propValues = Object.entries(updateInfo).map((prop) => prop[1]);
    const sql = `
            UPDATE threads
            SET ${propNames.length > 1 ? '(' : ''}${propNames}${propNames.length > 1 ? ')' : ''} =
            ${propNames.length > 1 ? '(' : ''}${propNames.map((propName, i) => `$${i + 2}`)}${propNames.length > 1 ? ')' : ''}
            WHERE ${isSlug ? 'slug' : 'id'} = $1 RETURNING id;`;

    if (!propNames.length) {
      return database.pool.connect().then((client) => client
        .query(isSlug ? this.threadExtractingSQL_slug : this.threadExtractingSQL_id, [slugOrID])
        .then((res) => ({ result: res.rows[0], status: 'ok' }))
        .finally(() => client.release()));
    }

    return database.pool.connect().then((client) => client
      .query(sql, [slugOrID, ...propValues])
      .then((res) => {
        if (!res.rows.length) {
          return ({
            result: {},
            status: 'not-found',
          });
        }
        return client
          .query(isSlug ? this.threadExtractingSQL_slug : this.threadExtractingSQL_id, [slugOrID])
          .then((res) => ({ result: res.rows[0], status: 'ok' }));
      })
      .catch((err) => ({
        result: err,
        status: 'not-found',
      }))
      .finally(() => client.release()));
  }
}
