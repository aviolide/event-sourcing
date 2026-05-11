import 'reflect-metadata';

import { UserBuilder } from '../../shared/builders/user.builder';
import { startTestEnvironment } from '../../shared/containers/test-environment';
import { postGraphql } from '../../shared/http-e2e.helper';

interface GraphqlErrorResponse {
  errors?: Array<{ extensions?: { code?: string } }>;
}

describe('Gateway Auth Guard Flow E2E', () => {
  let gatewayUrl: string;

  beforeAll(async () => {
    const config = await startTestEnvironment(['gateway']);
    gatewayUrl = `${config.services.gatewayUrl}/graphql`;
  }, 120000);

  it('should reject unauthenticated wallet query', async () => {
    const response = await postGraphql<GraphqlErrorResponse>(gatewayUrl, `
      query {
        wallet(userId: "some-user-id") {
          id
          balance
        }
      }
    `);

    console.log('should reject unathenticated wallet query response:', JSON.stringify(response, null, 2));
    expect(response.errors).toBeDefined();
  });

  it('should reject unauthenticated transfer mutation', async () => {
    const response = await postGraphql<GraphqlErrorResponse>(gatewayUrl, `
      mutation {
        transfer(input: {
          toUserId: "some-user-id",
          amount: 100,
          currency: "PEN"
        }) {
          id
          status
        }
      }
    `);

    expect(response.errors).toBeDefined();
  });

  it('should allow register mutation without auth', async () => {
    const user = UserBuilder.aUser().build();

    const response = await postGraphql<{
      data?: { register: { accessToken: string; refreshToken: string } };
      errors?: GraphqlErrorResponse['errors'];
    }>(
      gatewayUrl,
      `
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            accessToken
            refreshToken
          }
        }
      `,
      {
        input: {
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          password: user.password,
        },
      },
    );

    const code = response.errors?.[0]?.extensions?.code;
    expect(code).not.toBe('UNAUTHENTICATED');
  });

  it('should allow login mutation without auth', async () => {
    const response = await postGraphql<GraphqlErrorResponse>(
      gatewayUrl,
      `
        mutation {
          login(input: {
            identifier: "test@test.com",
            password: "Password123"
          }) {
            accessToken
          }
        }
      `,
    );

    const code = response.errors?.[0]?.extensions?.code;
    expect(code).not.toBe('UNAUTHENTICATED');
  });

  it('should reject wallet query with invalid JWT', async () => {
    const response = await postGraphql<GraphqlErrorResponse>(
      gatewayUrl,
      `
        query {
          wallet(userId: "some-id") {
            id
          }
        }
      `,
      undefined,
      'invalid.jwt.token',
    );

    expect(response.errors).toBeDefined();
  });
});
