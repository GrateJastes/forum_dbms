import { FastifyReply, FastifyRequest } from 'fastify';
import { Controller } from './Controller.js';
import { Service } from '../Models/Service.js';

export class ServiceController extends Controller {
  static getStatus(req: FastifyRequest, reply: FastifyReply) {
    return Service.getStatus().then((res) => reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send(res.result));
  }

  static clearAll(req: FastifyRequest, reply: FastifyReply) {
    return Service.clearAll().then((res) => reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send(null));
  }
}
