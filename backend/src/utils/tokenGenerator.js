/**
 * CSRF token generator - creates secure tokens based on IP, user agent, and timestamp.
 * Used to prevent cross-site request forgery attacks.
 */
const crypto = require('crypto');

function generateCsrfToken(ip, userAgent, timestamp = Date.now()) {
  const randomPart = crypto.randomBytes(32).toString('hex');
  const data = `${ip}-${userAgent}-${timestamp}-${randomPart}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = { generateCsrfToken };