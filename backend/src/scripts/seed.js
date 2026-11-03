const { cleanAndSeedDatabase } = require('./cleanDatabase');
const User = require('../modules/users/user.model');
const logger = require('../config/logger');

async function seedInitialData() {
  try {
    const adminExists = await User.findOne({ role: 'SUPER_ADMIN' });
    if (adminExists) {
      logger.info('Database already contains records. Skipping initial seeding.');
      return;
    }

    logger.info('Database is empty. Seeding official accounts...');
    await cleanAndSeedDatabase();
  } catch (error) {
    logger.error({ error: error.message }, 'Failed during initial data seeding');
  }
}

if (require.main === module) {
  seedInitialData();
}

module.exports = { seedInitialData };
