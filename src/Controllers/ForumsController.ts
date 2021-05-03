import { FastifyReply, FastifyRequest } from 'fastify';
import { Forum, IForumCreationInfo } from '../Models/Forum.js';
import { Controller } from './Controller.js';

interface IForumCreateRequest extends FastifyRequest {
  body: IForumCreationInfo;
}

interface IForumGetRequest extends FastifyRequest {
  params: { slug: string };
}

interface IForumThreadsRequest extends FastifyRequest {
  params: { slug: string };
  query: { limit?: string, since?: string, desc?: string };
}

export class ForumsController extends Controller {
  static createForum(req: IForumCreateRequest, reply: FastifyReply) {
    const forumInfo = req.body;

    return Forum.createForum(forumInfo).then((res) => {
      switch (res.status) {
      case 'ok':
        reply.code(201).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      case 'not-found':
        reply.code(404).header('Content-Type', 'application/json; charset=utf-8').send({ message: `Can't find user with nickname ${forumInfo.user}'` });
        break;
      case 'conflict':
        reply.code(409).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      default:
        reply.code(500).send();
      }
    });
  }
  static getForum(req: IForumGetRequest, reply: FastifyReply) {
    const slug = req.params.slug;
    return Forum.getForumInfo(slug).then((res) => {
      switch (res.status) {
      case 'ok':
        reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      case 'not-found':
        reply.code(404).header('Content-Type', 'application/json; charset=utf-8').send({ message: `Can't find forum with slug ${slug}'` });
        break;
      default:
        reply.code(500).send();
      }
    });
  }
  static getForumThreads(req: IForumThreadsRequest, reply: FastifyReply) {
    const slug = req.params.slug;
    const params = {
      limit: req.query.limit ? Number(req.query.limit) : 100,
      since: req.query.since ? req.query.since : '',
      desc: req.query.desc === 'true',
    };

    return Forum.getForumThreads(slug, params).then((res) => {
      switch (res.status) {
      case 'ok':
        reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      case 'not-found':
        reply.code(404).header('Content-Type', 'application/json; charset=utf-8').send({ message: `Can't find forum with slug ${slug}` });
        break;
      default:
        reply.code(500).send();
      }
    });
  }
}
