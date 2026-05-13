// =====================================================================
// services/smsService.js - SMS OTP Service via Twilio
// =====================================================================

const twilio = require('twilio');

function isSmsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

function getClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function generateOTP(length = 6) {
  return Math.floor(Math.pow(10, length - 1) + Math.random() * 9 * Math.pow(10, length - 1))
    .toString()
    .slice(0, length);
}

async function sendOTP(phone, otp) {
  const enabled = String(process.env.SMS_ENABLED || 'false').toLowerCase() === 'true';

  if (!enabled) {
    return { skipped: true, reason: 'SMS_ENABLED=false', otp };
  }

  if (!isSmsConfigured()) {
    return { skipped: true, reason: 'Twilio not configured', otp };
  }

  const client = getClient();
  const message = `Your NexTrade OTP is: ${otp}. Valid for 10 minutes. Do not share this code.`;

  await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone,
  });

  return { skipped: false };
}

module.exports = {
  generateOTP,
  sendOTP,
  isSmsConfigured,
};
