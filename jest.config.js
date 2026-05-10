/** @type {import('ts-jest').JestConfigWithTsJest} */

// Build a ts-jest transform with the given baseUrl so `src/*` imports inside
// each microservice (e.g. `import {...} from 'src/config/env.validation'`)
// resolve at type-check time. ts-jest performs full type-checking by default,
// so without `paths` it errors with "Cannot find module 'src/...'", even though
// jest's runtime `moduleNameMapper` would resolve them just fine.
const tsJestTransformFor = (paths) => ({
  '^.+\\.ts$': [
    'ts-jest',
    {
      tsconfig: {
        esModuleInterop: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        target: 'ES2023',
        module: 'commonjs',
        strictNullChecks: false,
        skipLibCheck: true,
        baseUrl: '.',
        paths,
      },
      diagnostics: { ignoreCodes: ['TS151001'] },
    },
  ],
});

const tsJestTransform = tsJestTransformFor({});

const baseE2eConfig = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  transform: tsJestTransform,
};

module.exports = {
  testTimeout: 120000,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
      ...baseE2eConfig,
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
      },
      moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
      },
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
      ...baseE2eConfig,
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
      },
      moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
      },
    },
    {
      displayName: 'e2e-auth',
      testMatch: [
        '<rootDir>/test/e2e/user-registration-flow/**/*.e2e-spec.ts',
        '<rootDir>/test/e2e/login-flow/**/*.e2e-spec.ts',
        '<rootDir>/test/e2e/token-refresh-flow/**/*.e2e-spec.ts',
      ],
      ...baseE2eConfig,
      transform: tsJestTransformFor({ 'src/*': ['01-auth/src/*'] }),
      moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/01-auth/src/$1',
      },
      setupFiles: ['<rootDir>/test/e2e/auth-flow-setup-env.ts'],
    },
    {
      displayName: 'e2e-wallet',
      testMatch: [
        '<rootDir>/test/e2e/wallet-transfer-flow/**/*.e2e-spec.ts',
        '<rootDir>/test/e2e/concurrency-flow/**/*.e2e-spec.ts',
        '<rootDir>/test/e2e/kafka-reliability-flow/**/*.e2e-spec.ts',
      ],
      ...baseE2eConfig,
      transform: tsJestTransformFor({ 'src/*': ['02-wallet/src/*'] }),
      moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/02-wallet/src/$1',
      },
    },
    {
      displayName: 'e2e-payments',
      testMatch: [
        '<rootDir>/test/e2e/payment-processing-flow/**/*.e2e-spec.ts',
      ],
      ...baseE2eConfig,
      transform: tsJestTransformFor({ 'src/*': ['03-payments/src/*'] }),
      moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/03-payments/src/$1',
      },
    },
    {
      displayName: 'e2e-gateway',
      testMatch: [
        '<rootDir>/test/e2e/gateway-flow/**/*.e2e-spec.ts',
      ],
      ...baseE2eConfig,
      transform: tsJestTransformFor({ 'src/*': ['00-gateway/src/*'] }),
      moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/00-gateway/src/$1',
      },
      setupFiles: ['<rootDir>/test/e2e/gateway-flow/setup-env.ts'],
    },
    {
      displayName: 'e2e-platform',
      testMatch: [
        '<rootDir>/test/e2e/platform-flow/**/*.e2e-spec.ts',
      ],
      ...baseE2eConfig,
    },
    {
      displayName: 'contracts',
      testMatch: ['<rootDir>/test/contracts/**/*.spec.ts'],
      ...baseE2eConfig,
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
      },
    },
    {
      displayName: 'chaos',
      testMatch: ['<rootDir>/test/chaos/**/*.spec.ts'],
      ...baseE2eConfig,
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
      },
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/test/performance/**/*.spec.ts'],
      ...baseE2eConfig,
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
      },
    },
  ],
  collectCoverageFrom: [
    'test/**/*.ts',
    '!test/**/*.spec.ts',
    '!test/**/*.e2e-spec.ts',
    '!test/shared/**',
    '!test/fixtures/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};
