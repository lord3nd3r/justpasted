// Example configuration (do NOT commit secrets here)
// Copy to `config.js` or set the environment variables listed below.
// This file is safe to check into GitHub because it contains no secrets.

module.exports = {
  // Ports
  HTTP_PORT: process.env.HTTP_PORT || 80,
  HTTPS_PORT: process.env.HTTPS_PORT || 443,

  // Paths
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  PUBLIC_DIR: process.env.PUBLIC_DIR || 'public',

  // Per-user quota (bytes)
  QUOTA_BYTES: Number(process.env.QUOTA_BYTES) || 1024 * 1024 * 1024,

  // Admin / owner
  OWNER_EMAIL: process.env.OWNER_EMAIL || 'owner@example.com',
  ENABLE_ADMIN_REGISTRATION: process.env.ENABLE_ADMIN_REGISTRATION === '1' || false,

  // Email verification toggle
  EMAIL_VERIFICATION_ENABLED: process.env.EMAIL_VERIFICATION_ENABLED === '1' || false,

  // Mail server settings (use env vars in production). Leave blank here.
  // NEVER put real passwords into checked-in files.
  MAIL: {
    HOST: process.env.MAIL_HOST || 'smtp.example.com',
    PORT: Number(process.env.MAIL_PORT) || 587,
    SECURE: process.env.MAIL_SECURE === '1' || false,
    AUTH_USER: process.env.MAIL_USER || '',
    AUTH_PASS: process.env.MAIL_PASS || null, // set via env, not here
    FROM: process.env.MAIL_FROM || 'JustPasted <no-reply@example.com>'
  },

  // Site / domain
  LETSENCRYPT_DOMAIN: process.env.LETSENCRYPT_DOMAIN || null,
  SITE_URL: process.env.SITE_URL || (process.env.LETSENCRYPT_DOMAIN ? `https://${process.env.LETSENCRYPT_DOMAIN}` : null),
  SITE_NAME: process.env.SITE_NAME || 'JustPasted',

  // Optional: AES key for encrypting settings stored in DB (hex/base64)
  // If you want the app to persist encrypted secrets (MAIL.AUTH_PASS),
  // set SETTINGS_KEY in the environment instead of storing passwords in files.
  SETTINGS_KEY: process.env.SETTINGS_KEY || null,

  // Letsencrypt live path (if using certs on the host)
  LETSENCRYPT: {
    LIVE_PATH: process.env.LETSENCRYPT_LIVE_PATH || '/etc/letsencrypt/live'
  }
};
