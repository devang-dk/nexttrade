// =====================================================================
// services/emailService.js - SMTP Email Service
// =====================================================================

const nodemailer = require('nodemailer');

function toBool(value) {
  return String(value || '').toLowerCase() === 'true';
}

function isMailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.MAIL_FROM
  );
}

function createTransporter() {
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendGoogleLoginEmail(user) {
  const enabled = toBool(process.env.MAIL_ENABLED);

  if (!enabled) return { skipped: true, reason: 'MAIL_ENABLED=false' };
  if (!isMailConfigured()) return { skipped: true, reason: 'SMTP not configured' };

  const transporter = createTransporter();
  const now = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

  const text = [
    `Hi ${user.name || 'there'},`,
    '',
    'You successfully signed in to NexTrade using Google.',
    `Time: ${now}`,
    '',
    'If this was not you, please secure your Google account and contact support immediately.',
    '',
    'Thanks,',
    'NexTrade Team',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2 style="margin-bottom: 8px;">NexTrade Sign-in Alert</h2>
      <p>Hi ${user.name || 'there'},</p>
      <p>You successfully signed in to <strong>NexTrade</strong> using Google.</p>
      <p><strong>Time:</strong> ${now}</p>
      <p>If this was not you, please secure your Google account and contact support immediately.</p>
      <p style="margin-top: 20px;">Thanks,<br/>NexTrade Team</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: user.email,
    subject: 'NexTrade Google Sign-in Alert',
    text,
    html,
  });

  return { skipped: false };
}

async function sendWelcomeEmail(user) {
  const enabled = toBool(process.env.MAIL_ENABLED);

  if (!enabled) return { skipped: true, reason: 'MAIL_ENABLED=false' };
  if (!isMailConfigured()) return { skipped: true, reason: 'SMTP not configured' };

  const transporter = createTransporter();
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  const text = [
    `Hi ${user.name || 'there'},`,
    '',
    'Welcome to NexTrade! 🎉',
    '',
    'Your account has been successfully created. You now have a $10,000 paper trading balance to start trading.',
    '',
    'Get Started:',
    `1. Visit ${appUrl}`,
    '2. Log in with your credentials',
    '3. Explore the market and start trading',
    '',
    'Features:',
    '• Real-time market data',
    '• Advanced charting tools',
    '• Instant order execution',
    '• Portfolio analytics',
    '',
    'If you have any questions, please contact our support team.',
    '',
    'Happy trading!',
    'NexTrade Team',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111; max-width: 600px;">
      <div style="background: linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to NexTrade! 🎉</h1>
      </div>
      
      <p>Hi ${user.name || 'there'},</p>
      
      <p>Your account has been successfully created. You now have a <strong>$10,000 paper trading balance</strong> to start trading.</p>
      
      <h3 style="margin-top: 24px;">Get Started:</h3>
      <ol>
        <li>Visit <a href="${appUrl}" style="color: #7c3aed; text-decoration: none;">${appUrl}</a></li>
        <li>Log in with your credentials</li>
        <li>Explore the market and start trading</li>
      </ol>
      
      <h3>Features:</h3>
      <ul style="list-style: none; padding: 0;">
        <li>📈 Real-time market data</li>
        <li>📊 Advanced charting tools</li>
        <li>⚡ Instant order execution</li>
        <li>💼 Portfolio analytics</li>
      </ul>
      
      <p style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #eee;">
        If you have any questions, please contact our support team.
      </p>
      
      <p style="margin-top: 20px;">Happy trading!<br/><strong>NexTrade Team</strong></p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: user.email,
    subject: 'Welcome to NexTrade - Your Trading Journey Starts Here!',
    text,
    html,
  });

  return { skipped: false };
}

module.exports = {
  sendGoogleLoginEmail,
  sendWelcomeEmail,
};
