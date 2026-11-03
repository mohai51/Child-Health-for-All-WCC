let argon2 = null;
try {
  argon2 = require('argon2');
} catch (e) {
  // Native argon2 binary failed to load on serverless container, fallback to crypto
  argon2 = null;
}
const crypto = require('crypto');

/**
 * Hash password using Argon2id with crypto fallback
 */
async function hashPassword(plainPassword) {
  if (argon2) {
    try {
      return await argon2.hash(plainPassword, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16, // 64 MB
        timeCost: 3,
        parallelism: 1
      });
    } catch (e) {
      // Fallback if native hash throws
    }
  }

  // Pure Node stdlib fallback using scrypt (zero native dependencies)
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(plainPassword, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verify password against Argon2id hash or scrypt fallback
 */
async function verifyPassword(hash, plainPassword) {
  if (!hash || !plainPassword) return false;

  if (hash.startsWith('scrypt:')) {
    const parts = hash.split(':');
    const salt = parts[1];
    const key = parts[2];
    return new Promise((resolve) => {
      crypto.scrypt(plainPassword, salt, 64, (err, derivedKey) => {
        if (err) return resolve(false);
        resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
      });
    });
  }

  if (argon2) {
    try {
      return await argon2.verify(hash, plainPassword);
    } catch (err) {
      return false;
    }
  }

  return false;
}

/**
 * Generate a cryptographically secure random token (hex)
 */
function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Sanitize string values for CSV / Excel exports to prevent Formula Injection (CSV Injection)
 * Prevents execution of formulas starting with =, +, -, @, or tab/return
 */
function sanitizeFormulaInjection(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Sanitize query object to prevent NoSQL operator injection ($where, $gt, etc.)
 */
function sanitizeNoSql(input) {
  if (input instanceof Object) {
    for (const key in input) {
      if (/^\$/.test(key)) {
        delete input[key];
      } else {
        sanitizeNoSql(input[key]);
      }
    }
  }
  return input;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateRandomToken,
  sanitizeFormulaInjection,
  sanitizeNoSql
};
