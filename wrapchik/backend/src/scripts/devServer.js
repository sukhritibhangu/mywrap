process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const { startServer } = require('../server');

startServer().catch((error) => {
  console.error(`[Startup Error] ${error.message}`);
  process.exitCode = 1;
});
