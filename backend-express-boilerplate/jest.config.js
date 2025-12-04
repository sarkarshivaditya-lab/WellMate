module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'routes/**/*.js',
    'services/**/*.js',
    '!**/*.test.js',
  ],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
};
