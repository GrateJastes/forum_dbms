import { FastifyReply, FastifyRequest } from 'fastify';
import { Controller } from './Controller.js';
import { IUserProfileInfo, User } from '../Models/User.js';

interface IUserRequest extends FastifyRequest {
  params: { nickname: string },
}

interface IUserCreateRequest extends IUserRequest {
  body: IUserProfileInfo,
}

interface IForumUsersRequest extends FastifyRequest {
  params: { slug: string };
  query: { limit?: string, since?: string, desc?: string };
}

export class UsersController extends Controller {
  static createUser(req: IUserCreateRequest, reply: FastifyReply) {
    const nickname = req.params.nickname;
    const profile = req.body;

    return User
      .createUser(profile, nickname)
      .then((res) => {
        switch (res.status) {
        case 'ok':
          reply.code(201).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
          break;
        case 'conflict':
          reply.code(409).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
          break;
        default:
          reply.code(500).send();
        }
      });
  }

  static getUser(req: IUserRequest, reply: FastifyReply) {
    const nickname = req.params.nickname;

    return User.getUser(nickname).then((res) => {
      switch (res.status) {
      case 'ok':
        reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      case 'not-found':
        reply.code(404).header('Content-Type', 'application/json; charset=utf-8').send({ message: `Can't find user with nickname ${nickname}` });
        break;
      default:
        reply.code(500).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
      }
    });
  }

  static updateUser(req: IUserCreateRequest, reply: FastifyReply) {
    const nickname = req.params.nickname;
    const profile = req.body;

    return User.updateUserInfo(nickname, profile).then((res) => {
      switch (res.status) {
      case 'ok':
        reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      case 'not-found':
        reply.code(404).header('Content-Type', 'application/json; charset=utf-8').send({ message: `Can't find user by nickname: ${nickname}'` });
        break;
      case 'conflict':
        reply.code(409).header('Content-Type', 'application/json; charset=utf-8').send({ message: `Can't find user by nickname: ${nickname}'` });
        break;
      default:
        reply.code(500).send();
      }
    });
  }

  static getForumUsers(req: IForumUsersRequest, reply: FastifyReply) {
    const slug = req.params.slug;
    const params = {
      limit: req.query.limit ? Number(req.query.limit) : 100,
      since: req.query.since ? req.query.since : '',
      desc: req.query.desc === 'true',
    };

    return User.getForumUsers(slug, params).then((res) => {
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
