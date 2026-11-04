const { cleanAndSeedDatabase } = require('./cleanDatabase');
const User = require('../modules/users/user.model');
const { hashPassword } = require('../utils/security');
const logger = require('../config/logger');

async function ensureMeasurementOfficerAccount() {
  try {
    const existing = await User.findOne({ email: 'm@wcc.org.bd' });
    if (!existing) {
      const passwordHash = await hashPassword('Measure@123');
      await User.create({
        name: 'পরিমাপ কর্মকর্তা (Measurement Officer)',
        email: 'm@wcc.org.bd',
        passwordHash,
        role: 'MEASUREMENT_OFFICER',
        accountStatus: 'ACTIVE'
      });
      logger.info('Official Measurement Officer account created: m@wcc.org.bd');
    } else {
      if (existing.role !== 'MEASUREMENT_OFFICER' || existing.accountStatus !== 'ACTIVE') {
        existing.role = 'MEASUREMENT_OFFICER';
        existing.accountStatus = 'ACTIVE';
        await existing.save();
      }
    }
  } catch (err) {
    logger.warn({ error: err.message }, 'Could not ensure Measurement Officer account');
  }
}

async function seedInitialData() {
  try {
    const adminExists = await User.findOne({ role: 'SUPER_ADMIN' });
    if (adminExists) {
      logger.info('Database already contains records. Skipping initial seeding.');
      await ensureMeasurementOfficerAccount();
      return;
    }

    logger.info('Database is empty. Seeding official accounts...');
    await cleanAndSeedDatabase();
    await ensureMeasurementOfficerAccount();
  } catch (error) {
    logger.error({ error: error.message }, 'Failed during initial data seeding');
  }
}

if (require.main === module) {
  seedInitialData();
}

module.exports = { seedInitialData };
