const pino = require('pino');
const config = require('./env');

const isDev = config.env !== 'production';

const logger = pino({
  level: isDev ? 'debug' : 'info',
  // Redact sensitive healthcare and credential fields from logs
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'password',
      'passwordHash',
      'guardianPhone',
      'phone',
      'prescriptionImage',
      '*.password',
      '*.passwordHash'
    ],
    remove: true
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    : undefined
});

module.exports = logger;
