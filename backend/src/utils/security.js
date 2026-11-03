const argon2 = require('argon2');
const crypto = require('crypto');

/**
 * Hash password using Argon2id
 */
async function hashPassword(plainPassword) {
  return await argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1
  });
}

/**
 * Verify password against Argon2id hash
 */
async function verifyPassword(hash, plainPassword) {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch (err) {
    return false;
  }
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
