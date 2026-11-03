const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
const { connectDB, disconnectDB } = require('./config/database');
const { seedInitialData } = require('./scripts/seed');

async function startServer() {
  try {
    // Connect to database
    await connectDB();

    // Seed default administrative and demo accounts if database is empty
    await seedInitialData();

    const server = app.listen(config.port, () => {
      logger.info(`================================================================`);
      logger.info(`🚀 WCC Child Health Registry Server running on port ${config.port}`);
      logger.info(`🌐 Environment: ${config.env}`);
      logger.info(`🏥 Access Dashboard: http://localhost:${config.port}`);
      logger.info(`================================================================`);
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    logger.error({ error: error.message }, 'Fatal error during server startup');
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
