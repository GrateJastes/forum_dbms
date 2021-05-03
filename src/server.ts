/* eslint-disable import/newline-after-import,import/first */
// @ts-nocheck
import { config } from 'dotenv';
config();

import fastify from 'fastify';
import { UsersController } from './Controllers/UsersController.js';
import { constants } from './consts.js';
import { ForumsController } from './Controllers/ForumsController.js';
import { ThreadsController } from './Controllers/ThreadsController.js';
import { ServiceController } from './Controllers/ServiceController.js';
import { PostsController } from './Controllers/PostsController.js';

const fastifyInstance = fastify({
  logger: false,
  // logger: {
  //   level: 'info',
  //   file: './logs.log',
  // },
});

fastifyInstance.post(constants.paths.userCreate, UsersController.createUser);
fastifyInstance.get(constants.paths.getUser, UsersController.getUser);
fastifyInstance.post(constants.paths.updateUser, UsersController.updateUser);
fastifyInstance.get(constants.paths.getForumUsers, UsersController.getForumUsers);


fastifyInstance.post(constants.paths.forumCreate, ForumsController.createForum);
fastifyInstance.get(constants.paths.getForum, ForumsController.getForum);
fastifyInstance.get(constants.paths.forumThreads, ForumsController.getForumThreads);

fastifyInstance.post(constants.paths.threadCreate, ThreadsController.createThread);
fastifyInstance.get(constants.paths.getThread, ThreadsController.getThread);
fastifyInstance.post(constants.paths.updateThread, ThreadsController.updateThreadInfo);
fastifyInstance.post(constants.paths.threadVote, ThreadsController.voteForThread);

fastifyInstance.post(constants.paths.postCreate, PostsController.createPosts);
fastifyInstance.get(constants.paths.getPosts, PostsController.getPosts);
fastifyInstance.get(constants.paths.getPostInfo, PostsController.getOnePost);
fastifyInstance.post(constants.paths.updatePostInfo, PostsController.updatePost);

fastifyInstance.get(constants.paths.serviceStatus, ServiceController.getStatus);
fastifyInstance.post(constants.paths.clearAll, ServiceController.clearAll);

const port = process.env.PORT || 'fuck ts';

fastifyInstance.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req, body, done) => {
    if (body.length > 0) {
      done(null, JSON.parse(body));
    } else {
      done(null, {});
    }
  },
);

fastifyInstance.listen(port, '0.0.0.0', (err : Error, address : string) => {
  if (err) {
    fastifyInstance.log.error(err);
    process.exit(1);
  }

  fastifyInstance.log.info(`listening on ${address}`);
});

