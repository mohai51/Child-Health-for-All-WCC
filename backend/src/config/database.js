const mongoose = require('mongoose');
const config = require('./env');
const logger = require('./logger');

let memoryServerInstance = null;
let cachedConnectPromise = null;

async function connectDB(customUri) {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    if (cachedConnectPromise) {
      await cachedConnectPromise;
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

    const mongooseOptions = {
      serverSelectionTimeoutMS: isVercel ? 10000 : 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: isVercel ? 10 : 25,
      minPoolSize: isVercel ? 1 : 2,
      family: 4, // Force IPv4 to eliminate IPv6 DNS timeout delays on cloud networks
      autoIndex: !isVercel, // Disable expensive index checking on every serverless invocation
      tlsAllowInvalidCertificates: true
    };

    cachedConnectPromise = (async () => {
      try {
        await mongoose.connect(uri, mongooseOptions);
        logger.info('Connected to MongoDB database successfully.');
      } catch (connectErr) {
        // In serverless Vercel environments, do not attempt to spawn embedded binaries
        if (isVercel) {
          logger.error({ error: connectErr.message }, 'Failed to connect to MongoDB Atlas on Vercel.');
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
            ...mongooseOptions,
            autoIndex: true
          });
          logger.info('Connected to embedded MongoDB Memory Server successfully.');
        } else {
          throw connectErr;
        }
      }
    })().catch(err => {
      cachedConnectPromise = null;
      throw err;
    });

    await cachedConnectPromise;

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
