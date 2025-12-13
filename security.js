const crypto = require('crypto');

// Use env var SETTINGS_KEY for encryption; must be 32 bytes for AES-256-GCM.
const KEY = process.env.SETTINGS_KEY || process.env.SESSION_SECRET || null;

if (!KEY) {
  console.warn('No SETTINGS_KEY provided; settings encryption will be disabled.');
}

function encrypt(text) {
  if (!KEY) return null;
  const key = Buffer.from(KEY).slice(0, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(payload) {
  if (!KEY) return null;
  try {
    const data = Buffer.from(payload, 'base64');
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const encrypted = data.slice(28);
    const key = Buffer.from(KEY).slice(0, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return out.toString('utf8');
  } catch (e) {
    console.error('Error decrypting settings payload:', e.message || e);
    return null;
  }
}

module.exports = { encrypt, decrypt };
