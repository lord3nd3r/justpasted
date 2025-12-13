const nodemailer = require('nodemailer');
const { CONFIG } = require('./config');

function createTransporter() {
  if (!CONFIG.MAIL.HOST || !CONFIG.MAIL.AUTH_USER) return null;
  try {
    return nodemailer.createTransport({
      host: CONFIG.MAIL.HOST,
      port: CONFIG.MAIL.PORT,
      secure: CONFIG.MAIL.SECURE,
      auth: {
        user: CONFIG.MAIL.AUTH_USER,
        pass: CONFIG.MAIL.AUTH_PASS
      }
    });
  } catch (e) {
    console.error('Error creating mail transporter:', e);
    return null;
  }
}

function sendEmail(to, subject, text, html) {
  return new Promise((resolve) => {
    const transporter = createTransporter();
    if (!transporter) {
      console.warn('Mail transporter not configured; skipping send to', to);
      return resolve(false);
    }
    transporter.sendMail({ from: CONFIG.MAIL.FROM, to, subject, text, html }, (err, info) => {
      if (err) {
        console.error('Error sending email:', err);
        return resolve(false);
      }
      resolve(true);
    });
  });
}

function sendVerificationEmail(userId, email, code) {
  const link = `${CONFIG.SITE_URL}/api/verify-email?uid=${encodeURIComponent(userId)}&code=${encodeURIComponent(code)}`;
  const subject = 'Verify your email';
  const text = `Please verify your account by visiting: ${link}`;
  const html = `<p>Please verify your account by clicking <a href="${link}">this link</a>.</p>`;
  return sendEmail(email, subject, text, html);
}

module.exports = { createTransporter, sendEmail, sendVerificationEmail };
