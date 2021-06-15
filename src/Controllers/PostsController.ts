import { FastifyReply, FastifyRequest } from 'fastify';
import { Controller } from './Controller.js';
import { IPostCreationData, Post } from '../Models/Post.js';

interface IPostsCreationRequest extends FastifyRequest {
  params: { slug_or_id: string };
  body: IPostCreationData[];
}

interface IGetPostRequest extends FastifyRequest {
  params: { id: number };
  query: { related?: string };
}

interface IPostUpdateRequest extends FastifyRequest {
  params: { id: number };
  body: { message: string; };
}

export interface IGetThreadPostsQuery {
  limit?: number, sort?: string, since?: number, desc?: string
}

interface IGetThreadPostsRequest extends FastifyRequest {
  params: { slug_or_id: string };
  query: IGetThreadPostsQuery;
}


export class PostsController extends Controller {
  static createPosts(req : IPostsCreationRequest, reply: FastifyReply) {
    const slugOrID = req.params.slug_or_id;
    const postsData = req.body;
    return Post.createPosts(slugOrID, postsData).then((res) => {
      switch (res.status) {
      case 'ok':
        reply.code(201)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send(res.result);
        break;
      case 'not-found':
        reply.code(404)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send(res.result);
        break;
      case 'conflict':
        reply.code(409)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send(res.result);
        break;
      default:
        reply.code(500).send();
      }
    });
  }

  static getPosts(req: IGetThreadPostsRequest, reply: FastifyReply) {
    const slugOrID = req.params.slug_or_id;
    const queryParams : IGetThreadPostsQuery = {};
    queryParams.limit = req.query.limit || 100;
    queryParams.since = req.query.since;
    queryParams.sort = req.query.sort || 'flat';
    queryParams.desc = req.query.desc === 'true' ? 'true' : '';

    Post.getPostsByThread(slugOrID, queryParams).then((res) => {
      switch (res.status) {
      case 'ok':
        reply.code(200)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send(res.result);
        break;
      case 'not-found':
        reply.code(404)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send(res.result);
        break;
      default:
        reply.code(500).send(res.result);
      }
    });
  }

  static getOnePost(req: IGetPostRequest, reply: FastifyReply) {
    const postID = req.params.id;
    const queryRelated = req.query.related;
    let related;
    if (queryRelated?.includes(',')) {
      related = queryRelated?.split(',');
    } else {
      related = [req.query.related];
    }

    return Post.getPost(postID, related as string[]).then((res) => {
      switch (res.status) {
      case 'ok':
        // console.log(res.result.forum);
        reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      case 'not-found':
        reply.code(404).header('Content-Type', 'application/json; charset=utf-8').send({ message: `Can't find post with id: ${postID}` });
        break;
      default:
        reply.code(500).send();
      }
    });
  }

  static updatePost(req: IPostUpdateRequest, reply: FastifyReply) {
    const postID = req.params.id;
    const message = req.body.message;

    return Post.updatePost(postID, message).then((res) => {
      switch (res.status) {
      case 'ok':
        reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
        break;
      case 'not-found':
        reply.code(404).header('Content-Type', 'application/json; charset=utf-8').send({ message: `Can't find post with id: ${postID}` });
        break;
      default:
        reply.code(500).header('Content-Type', 'application/json; charset=utf-8').send(res.result);
      }
    });
  }
}
