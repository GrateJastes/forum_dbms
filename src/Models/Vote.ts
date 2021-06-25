import { Model } from './Model.js';
import { database } from '../modules/db/db-connector.js';
import { Thread } from './Thread.js';

export class Vote extends Model {
  static voteThread(slugOrID: string, voice: number, nickname: string) {
    const isSlug = Number.isNaN(Number(slugOrID));

    const selectSQL = `
    SELECT * FROM votes
    ${isSlug ? 'JOIN threads t on t.slug = $2' : ''}
    WHERE user_nickname = $1 ${isSlug ? '' : 'AND thread_id = $2'}`;

    voice = voice === -1 || voice === 1 ? voice : 0;

    return database.pool.connect().then((client) => client
      .query(selectSQL, [nickname, slugOrID])
      .then((selectResult) => {
        if (selectResult.rows.length) {
          if (selectResult.rows[0].voice === voice || voice === 0) {
            return client.query(Thread.threadExtractingSQL(slugOrID), [slugOrID]).then((res) => ({ result: res.rows[0], status: 'ok' }));
          }

          return client
            .query(
              `UPDATE votes SET voice = $1 WHERE user_nickname = $2 AND thread_id = $3`,
              [voice, nickname, selectResult.rows[0].thread_id],
            )
            .then((res) => client
              .query(
                `UPDATE threads as t SET votes = votes + ${voice * 2} WHERE id = $1
                RETURNING t.id, t.title, t.author, t.forum_slug as forum, t.message, t.votes, t.slug, t.created`,
                [selectResult.rows[0].thread_id],
              )
              .then((res) => ({ result: res.rows[0], status: 'ok' })));
        }

        return client
          .query(`
          SELECT u.id as user_id, t.id as thread_id
          FROM users u
          JOIN threads t on u.nickname = $1 and ${isSlug ? 't.slug = $2' : 't.id = $2'}`,
          [nickname, slugOrID])
          .then((selectResult) => {
            if (selectResult.rows.length === 0) {
              return ({ result: {}, status: 'not-found' });
            }

            return client
              .query(
                `INSERT INTO votes (user_nickname, thread_id, voice) VALUES ($1, $2, $3)`,
                [nickname, selectResult.rows[0].thread_id, voice],
              )
              .then((res) => client
                .query(`UPDATE threads SET votes = votes ${voice === 1 ? '+ 1' : '- 1'} WHERE id = $1`, [selectResult.rows[0].thread_id])
                .then((res) => client.query(Thread.threadExtractingSQL(slugOrID), [slugOrID])
                  .then((res) => ({
                    result: res.rows[0],
                    status: 'ok',
                  }))));
          });
      })
      .catch((err) => ({ result: err, status: 'error' }))
      .finally(() => client.release()));
  }
}
