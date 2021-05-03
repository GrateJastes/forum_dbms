import { FastifyReply, FastifyRequest } from 'fastify';
import { Controller } from './Controller.js';
import { IThreadCreationInfo, Thread } from '../Models/Thread.js';
import { Vote } from '../Models/Vote.js';

interface IThreadCreateRequest extends FastifyRequest {
  params: { slug: string };
  body: IThreadCreationInfo;
}

interface IGetThreadRequest extends FastifyRequest {
  params: { slug_or_id: string };
}

interface IUpdateThreadRequest extends FastifyRequest {
  params: { slug_or_id: string };
  body: {
    message: string;
    title: string;
  }
}

interface IVoteThreadRequest extends FastifyRequest {
  params: { slug_or_id: string };
  body: {
    nickname: string;
    voice: number;
  }
}

export class ThreadsController extends Controller {
  static createThread(req: IThreadCreateRequest, reply: FastifyReply) {
    const slug = req.params.slug;
    const threadInfo = req.body;
    return Thread.createThread(slug, threadInfo).then((res) => {
      switch (res.status) {
      case 'ok':
        reply.code(201).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      case 'not-found':
        reply.code(404).header('Content-Type', 'application/json; charset=utf-8').send({ message: `Can't find user or forum` });
        break;
      case 'conflict':
        reply.code(409).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      default:
        reply.code(500).send();
      }
    });
  }

  static getThread(req: IGetThreadRequest, reply: FastifyReply) {
    const slugOrID = req.params.slug_or_id;

    return Thread.getThreadInfo(slugOrID).then((res) => {
      switch (res.status) {
      case 'ok':
        reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      case 'not-found':
        reply.code(404).header('Content-Type', 'application/json; charset=utf-8').send({ message: `Can't find thread with slug or ID ${slugOrID}` });
        break;
      default:
        reply.code(500).send();
      }
    });
  }

  static updateThreadInfo(req: IUpdateThreadRequest, reply: FastifyReply) {
    const slugOrID = req.params.slug_or_id;
    const threadUpdateInfo = req.body;

    return Thread.updateThreadInfo(slugOrID, threadUpdateInfo).then((res) => {
      switch (res.status) {
      case 'ok':
        reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      case 'not-found':
        reply.code(404).header('Content-Type', 'application/json; charset=utf-8').send({ message: `Can't find thread with slug or ID ${slugOrID}` });
        break;
      default:
        reply.code(500).send(res.result);
      }
    });
  }

  static voteForThread(req: IVoteThreadRequest, reply: FastifyReply) {
    const slugOrID = req.params.slug_or_id;
    const nickname = req.body.nickname;
    const voice = req.body.voice;

    return Vote.voteThread(slugOrID, voice, nickname).then((res) => {
      switch (res.status) {
      case 'ok':
        reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      case 'not-found':
        reply.code(404).header('Content-Type', 'application/json; charset=utf-8').send({ message: `Can't find thread with slug or ID ${slugOrID}` });
        break;
      default:
        reply.code(500).send();
      }
    });
  }
}
