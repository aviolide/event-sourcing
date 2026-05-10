module.exports = {
  displayName: '00-gateway',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
  },
  roots: ['<rootDir>', '../test'],
  testMatch: [
    '<rootDir>/**/*.spec.ts',
    '../test/unit/gateway/**/*.spec.ts',
  ],
};
