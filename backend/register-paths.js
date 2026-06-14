// Registers tsconfig-paths so @services/*, @utils/*, etc. resolve at runtime
// Used by serverless-offline via NODE_OPTIONS=-r ./register-paths.js
require('tsconfig-paths').register({
  baseUrl: __dirname,
  paths: {
    '@handlers/*': ['src/handlers/*'],
    '@services/*': ['src/services/*'],
    '@clients/*': ['src/clients/*'],
    '@adapters/*': ['src/adapters/*'],
    '@models/*': ['src/models/*'],
    '@utils/*': ['src/utils/*'],
    '@constants/*': ['src/constants/*'],
  },
});
