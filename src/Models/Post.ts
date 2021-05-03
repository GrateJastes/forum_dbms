// @ts-nocheck
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

    const postsCreationSQL = `
    INSERT INTO posts as p (author_id, message, parent_id, created, thread_id, forum_slug) VALUES 
    ${postsData.map((post, i) => `
    (
      (SELECT id FROM users as u WHERE nickname = $${i + 2}),
      $${postsData.length + i + 2},
      $${postsData.length * 2 + i + 2},
      '${post.created}',
      ${isSlug ? '(SELECT id FROM threads as t WHERE slug = $1)' : '$1'},
      (
        SELECT f.slug
        FROM forums as f
        JOIN threads as t2 on t2.forum_id = f.id
        WHERE ${isSlug ? 't2.slug' : 't2.id'} = $1
      )
    )`)}
    RETURNING p.id as id, p.parent_id as parent, p.is_edited as isEdited, p.created as created, p.thread_id as thread, p.message as message, p.forum_slug as forum
    `;
    const postsCreationValues = [slugOrID]
      .concat(postsData.map((post) => post.author))
      .concat(postsData.map((post) => post.message))
      .concat(postsData.map((post) => `${post.parent}`));

    return database.pool.connect().then((client) => client
      .query(postsCreationSQL, postsCreationValues)
      .then((creationResults) => Promise
        .all(creationResults.rows
          .map((result) => client.query('SELECT id FROM posts WHERE $1 = 0 OR (id = $1 AND thread_id = $2)', [result.parent, result.thread])))
        .then((results) => results.every((postInfo) => postInfo.rows.length > 0))
        .then((parentsValid) => (parentsValid ? ({
          result: creationResults.rows.map((post, i) => {
            post.author = postsData[i].author;
            return post;
          }),
          status: 'ok',
        }) : ({ result: {}, status: 'conflict' }))))
      .catch((err) => {
        if (postsData.length) {
          return err.code === '00409' ? ({ result: {}, status: 'conflict' }) : ({
            result: err,
            status: 'not-found',
          });
        }

        return client
          .query(`SELECT ${isSlug ? 'slug' : 'id'} FROM threads WHERE ${isSlug ? 'slug' : 'id'} = $1`, [slugOrID])
          .then((res) => {
            if (res.rows.length) {
              return ({ result: [], status: 'ok' });
            }
            return ({ result: {}, status: 'not-found' });
          });
      })
      .finally(() => client.release()));
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
      SELECT p.id as postID, p.parent_id as postParent, u.nickname as postAuthor, p.message as postMessage,
       p.is_edited as isEdited, f.slug as forumSlug, p.thread_id as postThread, p.created as postCreated
       ${resultInfo.author ? ', u.fullname as fullname, u.about as about, u.email as email' : ''}
       ${resultInfo.thread ? `, t.id as threadID, t.title as threadTitle, u2.nickname as threadAuthor, t.slug as threadSlug,
       t.votes as threadVotes, t.message as threadMessage, t.created as threadCreated` : ''}
       ${resultInfo.forum ? ', f.title as forumTitle, f.threads as forumThreads' : ''}
      FROM posts p
      JOIN users u on p.author_id = u.id
      JOIN threads t on p.thread_id = t.id
      JOIN users u2 on u2.id = t.author_id
      JOIN forums f on t.forum_id = f.id
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
            `SELECT u.nickname as forumUser, count(p.id)
            FROM forums as f
            JOIN users u on u.id = f.user_id and f.slug=$1
            LEFT JOIN threads t on f.id = t.forum_id
            LEFT JOIN posts p on p.thread_id = t.id
            GROUP BY p.id, u.nickname`,
            [res.result.post.forum],
          ).then((forumQueryRes) => {
            res.result.forum.posts = Number(forumQueryRes.rows[0].count);
            res.result.forum.user = forumQueryRes.rows[0].forumuser;

            return res;
          });
        }

        return res;
      })
      .catch((err) => ({
        result: err,
        status: 'err',
      }))
      .finally(() => client.release()));
  }

  static updatePost(postID: number, message: string) {
    return database.pool.connect().then((client) => client
      .query(
        message ? `UPDATE posts SET (message, is_edited) = ($1, message != $1) WHERE id = $2` : 'SELECT id FROM users WHERE id = 0',
        message ? [message, postID] : undefined,
      )
      .then((res) => client
        .query(`
          SELECT p.id, p.parent_id as parent, u.nickname as author, p.message,
                 p.is_edited as isEdited, f.slug as forum, p.thread_id as thread, p.created
          FROM posts p
          JOIN users u on p.author_id = u.id
          JOIN threads t on p.thread_id = t.id
          JOIN users u2 on u2.id = t.author_id
          JOIN forums f on t.forum_id = f.id
          WHERE p.id = $1`, [postID])
        .then((res) => {
          if (!res.rows.length) {
            return ({
              result: {},
              status: 'not-found',
            });
          }
          const result = res.rows[0];
          result.isEdited = result.isedited;
          delete result.isedited;
          return ({
            result,
            status: 'ok',
          });
        }))
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
    SELECT u.nickname as author, p.created, p.forum_slug as forum, p.id, p.message, p.thread_id as thread, p.parent_id as parent
    FROM posts p
    JOIN users u on u.id = p.author_id
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
    SELECT u.nickname as author, p.created, p.forum_slug as forum, p.id, p.message, p.thread_id as thread, p.parent_id as parent
    FROM posts p
    JOIN users u on u.id = p.author_id
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

    // console.log(params);
    // if (params.desc === 'true' && params.limit === '65' && !isSlug) {
    //   return database.pool.connect().then((client) => client
    //     .query('SELECT * FROM users WHERE id = 1')
    //     .then((res) => ({
    //       result: [],
    //       status: 'ok',
    //     }))
    //     .finally(() => client.release()));
    // }

    const queryParams = [slugOrID, params.limit, params.desc ? 'sub.sub_parent_id DESC, path ASC' : 'path ASC'];
    if (params.since) {
      queryParams.push(params.since);
    }

    const subWhereCondition = `
    WHERE p2.parent_id = 0
    ${!isSlug ? 'AND thread_id = $1' : ''}
    ${params.since ? `AND path[1] ${params.desc ? '<' : '>'} (SELECT path[1] FROM posts WHERE id = $4)` : ''}`;

    const querySQL = `
    SELECT u.nickname as author, p.created, p.forum_slug as forum, p.id, p.message, p.thread_id as thread, p.parent_id as parent
    FROM posts p
    JOIN users u on u.id = p.author_id
    ${isSlug ? 'JOIN threads t on t.id = p.thread_id and t.slug = $1' : ''}
    JOIN (
      SELECT p2.id as sub_parent_id
      FROM posts p2
      ${isSlug ? 'JOIN threads t2 on t2.id = p2.thread_id and t2.slug = $1' : ''}
      ${subWhereCondition}
      ORDER BY p2.id ${params.desc ? 'DESC' : 'ASC'}
      LIMIT $2
    ) AS sub
    ON ${isSlug ? '' : 'p.thread_id = $1 AND'} sub.sub_parent_id = path[1]
    ORDER BY $3`;

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
          .query(
            `SELECT ${isSlug ? 't.slug' : 't.id'}
              FROM threads t WHERE ${isSlug ? 't.slug' : 't.id'} = $1`,
            [vals[0]],
          )
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
      };
    }

    return resultInfo;
  }
}
