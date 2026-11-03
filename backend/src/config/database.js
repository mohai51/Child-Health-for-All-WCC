const mongoose = require('mongoose');
const config = require('./env');
const logger = require('./logger');

let memoryServerInstance = null;

async function connectDB(customUri) {
  try {
    let uri = customUri || (process.env.NODE_ENV === 'test' ? '' : config.mongodbUri);

    if (!uri) {
      logger.info('No MONGODB_URI configured. Starting embedded MongoDB Memory Server for seamless development/testing...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServerInstance = await MongoMemoryServer.create();
      uri = memoryServerInstance.getUri();
      logger.info(`Embedded MongoDB Memory Server started successfully at ${uri}`);
    }

    mongoose.set('strictQuery', true);

    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        autoIndex: true,
        tlsAllowInvalidCertificates: true
      });
      logger.info('Connected to MongoDB database successfully.');
    } catch (connectErr) {
      // If remote connection failed and we haven't tried in-memory server yet, fall back automatically
      if (!memoryServerInstance && !customUri) {
        logger.warn({ error: connectErr.message }, 'Failed to connect to configured MongoDB URI. Falling back to embedded MongoDB Memory Server...');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        memoryServerInstance = await MongoMemoryServer.create();
        uri = memoryServerInstance.getUri();
        logger.info(`Embedded MongoDB Memory Server started successfully at ${uri}`);

        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 5000,
          autoIndex: true,
          tlsAllowInvalidCertificates: true
        });
        logger.info('Connected to embedded MongoDB Memory Server successfully.');
      } else {
        throw connectErr;
      }
    }

    mongoose.connection.on('error', (err) => {
      logger.error({ err }, 'MongoDB connection error occurred');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    return mongoose.connection;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to connect to MongoDB');
    throw error;
  }
}

async function disconnectDB() {
  try {
    await mongoose.disconnect();
    if (memoryServerInstance) {
      await memoryServerInstance.stop();
      memoryServerInstance = null;
    }
    logger.info('Disconnected from MongoDB.');
  } catch (err) {
    logger.error({ err }, 'Error during MongoDB disconnection');
  }
}

module.exports = {
  connectDB,
  disconnectDB
};
