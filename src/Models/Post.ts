// @ts-nocheck

import { PoolClient } from 'pg';
import { Model } from './Model.js';
import { database } from '../modules/db/db-connector.js';
import { IGetThreadPostsQuery } from '../Controllers/PostsController';

export interface IPostCreationData {
  parent: number;
  author: string;
  message: string;
  created?: string;
}

export class Post extends Model {
  static createPosts(slugOrID: string, postsData: IPostCreationData[]) {
    const isSlug = Number.isNaN(Number(slugOrID));
    const createdDatetime = new Date(Date.now()).toISOString();

    postsData = postsData.map((post) => {
      if (!post.created) {
        post.created = createdDatetime;
      }
      if (!post.parent) {
        post.parent = 0;
      }

      return post;
    });

    return database.pool.connect().then((client) => client
      .query(`SELECT id FROM threads WHERE ${isSlug ? 'slug' : 'id'} = $1`, [slugOrID])
      .then((res) => {
        if (!res.rows.length) {
          throw new Error('Thread not found');
        }

        return this.createPostsByThreadID(client, res.rows[0].id, postsData);
      })
      .catch((err) => {
        if (err.message === 'Thread not found') {
          return ({ result: {}, status: 'not-found' });
        }

        return ({ result: err, status: 'error' });
      })
      .finally(() => client.release()));
  }

  static createPostsByThreadID(client: PoolClient, threadID: number, postsData: IPostCreationData[]) {
    return Promise
      .all(postsData.map((post) => {
        if (post.parent) {
          return client.query(`SELECT id FROM posts WHERE id = $1 AND thread_id = $2`, [post.parent, threadID]);
        }

        return new Promise((resolve, reject) => resolve({ rows: [1] }));
      }))
      .then((checkResults) => checkResults.every((checkRes) => checkRes.rows.length > 0))
      .then((parentsValid) => {
        if (!parentsValid) {
          throw new Error('Parents are invalid');
        }
      })
      .then(() => client
        .query(`SELECT forum_slug FROM threads WHERE id = $1`, [threadID])
        .then((forumSlugQuery) => {
          const forumSlug = forumSlugQuery.rows[0].forum_slug;
          const postsCreationValues = [threadID, forumSlug]
            .concat(postsData.map((post) => post.author))
            .concat(postsData.map((post) => post.message))
            .concat(postsData.map((post) => `${post.parent}`));

          const postsCreationSQL = `
            INSERT INTO posts as p (author, message, parent, created, thread_id, forum_slug) VALUES 
            ${postsData.map((post, i) => `
            (
              $${i + 3},
              $${postsData.length + i + 3},
              $${postsData.length * 2 + i + 3},
              '${post.created}',
              $1,
              $2
            )`)}
            RETURNING p.id, p.created`;

          return client
            .query(postsCreationSQL, postsCreationValues)
            .then((creationResults) => creationResults.rows.map((resultData, i) => {
              resultData.author = postsData[i].author;
              resultData.message = postsData[i].message;
              resultData.isEdited = false;
              resultData.forum = forumSlug;
              resultData.thread = threadID;
              resultData.parent = postsData[i].parent;

              return resultData;
            }))
            .then((createdPosts) => ({ result: createdPosts, status: 'ok' }));
        }))
      .catch((err) => {
        if (err.message === 'Parents are invalid') {
          return ({ result: {}, status: 'conflict' });
        }

        if (postsData.length) {
          return err.code === '00409' ? ({ result: {}, status: 'conflict' }) : ({
            result: err,
            status: 'not-found',
          });
        }
        return ({ result: [], status: 'ok' });
      });
  }

  static getPostsByThread(slugOrID: string, getParams: IGetThreadPostsQuery) {
    switch (getParams.sort) {
    case 'tree':
      return this.getThreadPostsTreeSort(slugOrID, getParams);
    case 'parent_tree':
      return this.getThreadPostsParentTreeSort(slugOrID, getParams);
    default:
      return this.getThreadPostsFlatSort(slugOrID, getParams);
    }
  }

  static getPost(postID: number, related: string[] | undefined) {
    related = related || [];
    const resultInfo : {post: Record<string, unknown>, thread?: Record<string, unknown>, author?: Record<string, unknown>, forum?: Record<string, unknown> } = { post: {} };
    if (related.includes('thread')) {
      resultInfo.thread = {};
    }
    if (related.includes('user')) {
      resultInfo.author = {};
    }
    if (related.includes('forum')) {
      resultInfo.forum = {};
    }

    const requestSQL = `
      SELECT p.id as postID, p.parent as postParent, p.author as postAuthor, p.message as postMessage,
       p.is_edited as isEdited, p.forum_slug as forumSlug, p.thread_id as postThread, p.created as postCreated
       ${resultInfo.author ? ', u.fullname as fullname, u.about as about, u.email as email' : ''}
       ${resultInfo.thread ? `, t.id as threadID, t.title as threadTitle, t.author as threadAuthor, t.slug as threadSlug,
       t.votes as threadVotes, t.message as threadMessage, t.created as threadCreated` : ''}
       ${resultInfo.forum ? ', f.title as forumTitle, f.threads as forumThreads, f.user as forumUser' : ''}
      FROM posts p
      ${resultInfo.author ? 'JOIN users u on u.nickname = p.author' : ''}
      ${resultInfo.thread || resultInfo.forum ? 'JOIN threads t on p.thread_id = t.id' : ''}
      ${resultInfo.forum ? 'JOIN forums f on t.forum_slug = f.slug' : ''}
      WHERE p.id = $1`;

    return database.pool.connect().then((client) => client
      .query(requestSQL, [postID])
      .then((queryRes) => {
        if (!queryRes.rows.length) {
          return ({ result: {}, status: 'not-found' });
        }

        return ({
          result: this.makePostsGetResult(queryRes.rows[0], resultInfo),
          status: 'ok',
        });
      })
      .then((res) => {
        if (res.status === 'not-found') {
          return res;
        }

        if (res.result.forum) {
          return client.query(
            `SELECT count(p.id)
            FROM forums as f
            LEFT JOIN threads t on f.slug = t.forum_slug
            LEFT JOIN posts p on p.thread_id = t.id
            WHERE f.slug = $1
            GROUP BY p.id`,
            [res.result.post.forum],
          ).then((forumQueryRes) => {
            res.result.forum.posts = Number(forumQueryRes.rows[0] ? forumQueryRes.rows[0].count : 0);
            return res;
          });
        }

        return res;
      })
      .catch((err) => {
        console.log(err);
        return ({
          result: err,
          status: 'err',
        });
      })
      .finally(() => client.release()));
  }

  static updatePost(postID: number, message: string) {
    if (!message) {
      return this.getPost(postID).then((res) => ({ result: res.result.post, status: 'ok' }));
    }
    const updateSQL = `
      UPDATE posts
      SET (message, is_edited) = ($1, message != $1)
      WHERE id = $2
      RETURNING id, author, created, forum_slug as forum, is_edited, message, thread_id as thread`;

    return database.pool.connect().then((client) => client
      .query(
        message ? updateSQL : 'SELECT id FROM users WHERE id = 0',
        message ? [message, postID] : undefined,
      )
      .then((res) => {
        if (!res.rows.length) {
          return ({
            result: {},
            status: 'not-found',
          });
        }

        const result = res.rows[0];
        result.isEdited = result.is_edited;
        delete result.is_edited;
        return ({
          result,
          status: 'ok',
        });
      })
      .catch((err) => ({
        result: err,
        status: 'not-found',
      }))
      .finally(() => client.release()));
  }

  private static getThreadPostsFlatSort(slugOrID: string, params: IGetPostsParams) {
    const isSlug = Number.isNaN(Number(slugOrID));
    const queryParams = [slugOrID, params.limit];
    if (params.since) {
      queryParams.push(params.since);
    }

    const querySQL = `
    SELECT p.author, p.created, p.forum_slug as forum, p.id, p.message, p.thread_id as thread, p.parent
    FROM posts p
    ${isSlug ? 'JOIN threads t on t.id = p.thread_id and t.slug = $1' : ''}
    ${(params.since || !isSlug) ? 'WHERE' : ''} ${params.since ? `p.id ${params.desc ? '<' : '>'} $3` : ''}
    ${(!isSlug && params.since) ? 'AND' : ''} ${isSlug ? '' : 'p.thread_id = $1'}
    ORDER BY p.created ${params.desc ? 'DESC' : 'ASC'}, id ${params.desc ? 'DESC' : 'ASC'}
    LIMIT $2`;

    return this.getPosts(querySQL, queryParams);
  }

  private static getThreadPostsTreeSort(slugOrID: string, params: IGetPostsParams) {
    const isSlug = Number.isNaN(Number(slugOrID));
    const querySQL = `
    SELECT p.author, p.created, p.forum_slug as forum, p.id, p.message, p.thread_id as thread, p.parent
    FROM posts p
    ${isSlug ? 'JOIN threads t on t.id = p.thread_id and t.slug = $1' : ''}
    ${(params.since || !isSlug) ? 'WHERE' : ''} ${isSlug ? '' : 'p.thread_id = $1'}
    ${(!isSlug && params.since) ? 'AND' : ''} ${params.since ? `path ${params.desc ? '<' : '>'} (SELECT path FROM posts WHERE id = $3)` : ''}
    ORDER BY path ${params.desc ? 'DESC' : 'ASC'}
    LIMIT $2`;

    const queryParams = [slugOrID, params.limit];
    if (params.since) {
      queryParams.push(params.since);
    }
    return this.getPosts(querySQL, queryParams);
  }

  private static getThreadPostsParentTreeSort(slugOrID: string, params: IGetPostsParams) {
    const isSlug = Number.isNaN(Number(slugOrID));
    const queryParams = [slugOrID, params.limit];
    if (params.since) {
      queryParams.push(params.since);
    }

    const subWhereCondition = `
    WHERE p2.parent = 0
    ${!isSlug ? 'AND p2.thread_id = $1' : ''}
    ${params.since ? `AND path[1] ${params.desc ? '<' : '>'} (SELECT path[1] FROM posts WHERE id = $3)` : ''}`;

    const querySQL = `
    SELECT p.author, p.created, p.forum_slug as forum, p.id, p.message, p.thread_id as thread, p.parent as parent
    FROM posts p
    ${isSlug ? `JOIN threads t on t.id = p.thread_id and t.slug = $1` : ''}
    JOIN (
      SELECT p2.id as sub_parent
      FROM posts p2
      ${isSlug ? `JOIN threads t2 on t2.id = p2.thread_id and t2.slug = $1` : ''}
      ${subWhereCondition}
      ORDER BY p2.id ${params.desc ? 'DESC' : 'ASC'}
      LIMIT $2
    ) AS sub
    ON ${isSlug ? '' : 'p.thread_id = $1 AND'} sub.sub_parent = path[1]
    ORDER BY ${params.desc ? 'sub.sub_parent DESC, path ASC' : 'path'}`;

    return this.getPosts(querySQL, queryParams);
  }

  private static getPosts(query: string, vals: string[]) {
    return database.pool.connect().then((client) => client
      .query(query, vals)
      .then((res) => {
        if (res.rows.length) {
          return {
            result: res.rows,
            status: 'ok',
          };
        }

        const isSlug = Number.isNaN(Number(vals[0]));
        return client
          .query(`SELECT ${isSlug ? 'slug' : 'id'} FROM threads WHERE ${isSlug ? 'slug' : 'id'} = $1`, [vals[0]])
          .then((res) => (res.rows.length ? ({
            result: [],
            status: 'ok',
          }) : ({
            result: {},
            status: 'not-found',
          })));
      })
      .catch((err) => ({
        result: err,
        status: 'error',
      }))
      .finally(() => client.release()));
  }

  private static makePostsGetResult(queriedRow: Record<string, unknown>, resultInfo: Record<string, unknown>) {
    resultInfo.post = {
      id: queriedRow.postid,
      parent: queriedRow.postparent,
      author: queriedRow.postauthor,
      message: queriedRow.postmessage,
      isEdited: queriedRow.isedited,
      forum: queriedRow.forumslug,
      thread: queriedRow.postthread,
      created: queriedRow.postcreated,
    };

    if (resultInfo.author) {
      resultInfo.author = {
        nickname: queriedRow.postauthor,
        fullname: queriedRow.fullname,
        about: queriedRow.about,
        email: queriedRow.email,
      };
    }

    if (resultInfo.thread) {
      resultInfo.thread = {
        id: queriedRow.threadid,
        title: queriedRow.threadtitle,
        author: queriedRow.threadauthor,
        forum: queriedRow.forumslug,
        message: queriedRow.threadmessage,
        slug: queriedRow.threadslug,
        votes: queriedRow.threadvotes,
        created: queriedRow.threadcreated,
      };
    }

    if (resultInfo.forum) {
      resultInfo.forum = {
        title: queriedRow.forumtitle,
        threads: queriedRow.forumthreads,
        slug: queriedRow.forumslug,
        user: queriedRow.forumuser,
      };
    }

    return resultInfo;
  }
}
