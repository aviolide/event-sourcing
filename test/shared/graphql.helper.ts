import request from 'supertest';
import { INestApplication } from '@nestjs/common';

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string; extensions?: any }>;
}

export async function graphqlRequest<T = any>(
  app: INestApplication,
  query: string,
  variables?: Record<string, any>,
  token?: string,
): Promise<GraphQLResponse<T>> {
  const req = request(app.getHttpServer())
    .post('/graphql')
    .send({ query, variables });

  if (token) req.set('Authorization', `Bearer ${token}`);

  const response = await req;
  return response.body;
}
