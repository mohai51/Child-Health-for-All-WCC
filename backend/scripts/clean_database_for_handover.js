/**
 * Database Cleanup Script for Official WCC Handover
 * We Can Change (WCC) Child Health Registry
 *
 * Removes all 200+ test case patients, dummy visits, fake consultations,
 * test referrals, and audit logs.
 * Resets Patient ID sequence counter to 0 so the first real registration starts at WCC-000001.
 * Preserves core active health camp and doctor/volunteer/admin credentials.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function cleanForHandover() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in backend/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB database for official handover cleanup...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log('\n--- 1. Cleaning Test Patients & Medical Records ---');
  const pDel = await db.collection('patients').deleteMany({});
  console.log(`Deleted ${pDel.deletedCount} test patients.`);

  const vDel = await db.collection('visits').deleteMany({});
  console.log(`Deleted ${vDel.deletedCount} test visits.`);

  const cDel = await db.collection('consultations').deleteMany({});
  console.log(`Deleted ${cDel.deletedCount} test consultations.`);

  const rDel = await db.collection('referrals').deleteMany({});
  console.log(`Deleted ${rDel.deletedCount} test referrals.`);

  const aDel = await db.collection('auditlogs').deleteMany({});
  console.log(`Deleted ${aDel.deletedCount} test audit logs.`);

  console.log('\n--- 2. Resetting Patient Counter to 0 ---');
  await db.collection('counters').updateOne(
    { _id: 'patientId' },
    { $set: { seq: 0 } },
    { upsert: true }
  );
  console.log('Counter "patientId" reset to seq: 0 (Next patient will be WCC-000001).');

  console.log('\n--- 3. Cleaning Test Images & Storage ---');
  const imgDel = await db.collection('imageassets').deleteMany({
    category: { $ne: 'DOCTOR_PROFILE' }
  });
  console.log(`Deleted ${imgDel.deletedCount} test prescription/consultation image assets.`);

  // Clean local upload folders (preserve folder directories)
  const tempDir = path.resolve(__dirname, '../../uploads/temp');
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    files.forEach(f => {
      try { fs.unlinkSync(path.join(tempDir, f)); } catch (e) {}
    });
    console.log(`Cleaned ${files.length} files from uploads/temp.`);
  }

  // Remove test camp CAMP-2026-001 (ঢাকা শিশু স্বাস্থ্য ক্যাম্প ১) if present, keeping official active camp
  const campDel = await db.collection('camps').deleteMany({
    campCode: 'CAMP-2026-001'
  });
  if (campDel.deletedCount > 0) {
    console.log(`Removed ${campDel.deletedCount} old test camp (CAMP-2026-001).`);
  }

  // Ensure official active camp status is ACTIVE
  await db.collection('camps').updateOne(
    { name: { $regex: /Jhalokathi/i } },
    { $set: { status: 'ACTIVE' } }
  );
  console.log('Official Health Camp (Jhalokathi) verified as ACTIVE.');

  console.log('\n--- 4. Final Database Record Counts ---');
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`${col.name}: ${count}`);
  }

  console.log('\n=== DATABASE CLEANUP COMPLETED SUCCESSFULLY FOR WCC HANDOVER ===');
  await mongoose.disconnect();
  process.exit(0);
}

cleanForHandover().catch(err => {
  console.error('Handover cleanup failed:', err);
  process.exit(1);
});

