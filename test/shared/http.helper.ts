import request from 'supertest';
import { INestApplication } from '@nestjs/common';

export async function httpPost(
  app: INestApplication,
  path: string,
  body: Record<string, any>,
  token?: string,
) {
  const req = request(app.getHttpServer()).post(path).send(body);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req;
}

export async function httpGet(
  app: INestApplication,
  path: string,
  token?: string,
) {
  const req = request(app.getHttpServer()).get(path);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req;
}
