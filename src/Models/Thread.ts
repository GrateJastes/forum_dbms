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

export class Thread extends Model {
  static threadExtractingSQL(slugOrID: string) {
    return `
    SELECT id, title, author, forum_slug as forum, message, votes, slug, created
    FROM threads t
    WHERE ${Number.isNaN(Number(slugOrID)) ? 'slug' : 'id'} = $1`;
  }

  static createThread(forumSlug: string, threadInfo: IThreadCreationInfo) {
    const threadCreationSQL = `
    INSERT INTO threads as t (title, message, forum_slug, author${threadInfo.created ? ', created' : ''}${threadInfo.slug ? ', slug' : ''}) VALUES
    (
        $3,
        $4,
        (SELECT slug from forums f where f.slug = $1),
        (SELECT nickname from users u where u.nickname = $2)
        ${threadInfo.created ? ', $5' : ''}
        ${threadInfo.slug ? (threadInfo.created ? ', $6' : ', $5') : ''}
    )
    RETURNING t.id, t.title, t.message, t.slug, t.created, t.forum_slug as forum, t.author`;
    const threadCreationVals = [forumSlug, threadInfo.author, threadInfo.title, threadInfo.message];
    if (threadInfo.created) {
      threadCreationVals.push(threadInfo.created);
    }
    if (threadInfo.slug) {
      threadCreationVals.push(threadInfo.slug);
    }

    return database.pool.connect().then((client) => client
      .query(threadCreationSQL, threadCreationVals)
      .then((res) => ({ result: res.rows[0], status: 'ok' }))
      .catch((err) => {
        if (!err.detail.includes('already exists')) {
          return ({ result: {}, status: 'not-found' });
        }
        return client
          .query(this.threadExtractingSQL(threadInfo.slug), [threadInfo.slug])
          .then((res) => ({ result: res.rows[0], status: 'conflict' }));
      })
      .finally(() => client.release()));
  }

  static getThreadInfo(slugOrID: string) {
    return database.pool.connect().then((client) => client
      .query(this.threadExtractingSQL(slugOrID), [slugOrID])
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
        .query(this.threadExtractingSQL(slugOrID), [slugOrID])
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
          .query(this.threadExtractingSQL(slugOrID), [slugOrID])
          .then((res) => ({ result: res.rows[0], status: 'ok' }));
      })
      .catch((err) => ({
        result: err,
        status: 'not-found',
      }))
      .finally(() => client.release()));
  }
}
