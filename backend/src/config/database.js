const mongoose = require('mongoose');
const config = require('./env');
const logger = require('./logger');

let memoryServerInstance = null;

async function connectDB(customUri) {
  try {
    if (mongoose.connection && mongoose.connection.readyState >= 1) {
      return mongoose.connection;
    }

    const isVercel = Boolean(process.env.VERCEL);
    let uri = customUri || (process.env.NODE_ENV === 'test' ? '' : (process.env.MONGODB_URI || config.mongodbUri || ''));
    if (uri) {
      uri = uri.trim().replace(/^['"]|['"]$/g, '');
    }

    if (!uri) {
      if (isVercel) {
        throw new Error('MONGODB_URI is not set in Vercel Environment Variables! Please add MONGODB_URI in Vercel Project Settings.');
      }
      logger.info('No MONGODB_URI configured. Starting embedded MongoDB Memory Server for seamless development/testing...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServerInstance = await MongoMemoryServer.create();
      uri = memoryServerInstance.getUri();
      logger.info(`Embedded MongoDB Memory Server started successfully at ${uri}`);
    }

    mongoose.set('strictQuery', true);

    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: isVercel ? 12000 : 5000,
        autoIndex: true,
        tlsAllowInvalidCertificates: true
      });
      logger.info('Connected to MongoDB database successfully.');
    } catch (connectErr) {
      // In serverless Vercel environments, do not attempt to spawn embedded binaries
      if (isVercel) {
        logger.error({ error: connectErr.message }, 'Failed to connect to MongoDB Atlas on Vercel. Verify Network Access allows 0.0.0.0/0 in MongoDB Atlas.');
        throw new Error(`Failed to connect to MongoDB Atlas on Vercel: ${connectErr.message}. Make sure Network Access (IP Access List) in MongoDB Atlas allows 0.0.0.0/0.`);
      }

      // If remote connection failed in local dev, fall back automatically to in-memory server
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
