import { Model } from './Model.js';
import { database } from '../modules/db/db-connector.js';
import { Thread } from './Thread.js';

export class Vote extends Model {
  static voteThread(slugOrID: string, voice: number, nickname: string) {
    const isSlug = Number.isNaN(Number(slugOrID));
    const selectSQL = `
    SELECT *
    FROM votes
    JOIN users u on votes.user_id = u.id and nickname = $1
    ${!isSlug ? 'WHERE thread_id = $2' : 'JOIN threads t on t.slug = $2'}
    `;
    const threadExtractingSQL = isSlug ? Thread.threadExtractingSQL_slug : Thread.threadExtractingSQL_id;

    return database.pool.connect().then((client) => client
      .query(selectSQL, [nickname, slugOrID])
      .then((selectResult) => {
        if (selectResult.rows.length) {
          if (selectResult.rows[0].voice === voice) {
            return client.query(threadExtractingSQL, [slugOrID]).then((res) => ({ result: res.rows[0], status: 'ok' }));
          }

          return client
            .query(
              'UPDATE votes SET voice = $1 WHERE user_id = $2 and thread_id = $3',
              [voice, selectResult.rows[0].user_id, selectResult.rows[0].thread_id],
            )
            .then((res) => client
              .query(`UPDATE threads SET votes = votes ${voice === 1 ? '+ 2' : '- 2'} WHERE id = $1`, [selectResult.rows[0].thread_id])
              .then((res) => client.query(threadExtractingSQL, [slugOrID]).then((res) => ({ result: res.rows[0], status: 'ok' }))));
        }

        return client
          .query(`
          SELECT u.id as user_id, t.id as thread_id
          FROM users u
          JOIN threads t on u.nickname = $1 and ${isSlug ? 't.slug = $2' : 't.id = $2'}
          `, [nickname, slugOrID]).then((selectResult) => {
            if (selectResult.rows.length === 0) {
              return ({ result: {}, status: 'not-found' });
            }
            return client
              .query(
                `INSERT INTO votes (user_id, thread_id, voice) VALUES ($1, $2, ${voice === 1 ? '1' : '-1'})`,
                [selectResult.rows[0].user_id, selectResult.rows[0].thread_id],
              )
              .then((res) => client
                .query(`UPDATE threads SET votes = votes ${voice === 1 ? '+ 1' : '- 1'} WHERE id = $1`, [selectResult.rows[0].thread_id])
                .then((res) => client.query(threadExtractingSQL, [slugOrID])
                  .then((res) => ({
                    result: res.rows[0],
                    status: 'ok',
                  }))));
          });
      })
      .catch((err) => ({ result: {}, status: 'error' }))
      .finally(() => client.release()));
  }
}
