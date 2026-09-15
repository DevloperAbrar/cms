require('dotenv').config();

const app = require('./app');
const prisma = require('./config/prismaClient');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await prisma.$connect();
  logger.info('PostgreSQL connected via Prisma');

  const server = app.listen(PORT, () => {
    logger.info(`CampusCMS server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('HTTP server closed, Prisma disconnected');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced exit after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error(`Unhandled Rejection: ${reason}`));
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
    process.exit(1);
  });
};

start();