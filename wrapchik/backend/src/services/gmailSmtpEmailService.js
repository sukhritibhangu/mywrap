const nodemailer = require('nodemailer');

const purposeCopy = {
  SIGNUP: { subject: 'Verify your Wrapchik student account', heading: 'Create your Wrapchik account' },
  LOGIN: { subject: 'Your Wrapchik sign-in code', heading: 'Sign in to Wrapchik' },
  EMAIL_VERIFY: { subject: 'Verify your Wrapchik email', heading: 'Verify your email' },
  PASSWORD_RESET: { subject: 'Reset your Wrapchik password', heading: 'Reset your password' },
};

const escapeHtml = value => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const createGmailSmtpEmailService = ({ nodemailerClient = nodemailer, getEnv = () => process.env } = {}) => {
  let cachedSignature = '';
  let transporter = null;

  const sendOtpEmail = async ({ to, code, purpose }) => {
    const env = getEnv();
    if (!env.SMTP_USER || !env.SMTP_APP_PASSWORD) {
      const error = new Error('Gmail SMTP is not configured. Set SMTP_USER and SMTP_APP_PASSWORD in the backend environment.');
      error.statusCode = 503;
      throw error;
    }

    const signature = `${env.SMTP_USER}\u0000${env.SMTP_APP_PASSWORD}`;
    if (!transporter || signature !== cachedSignature) {
      cachedSignature = signature;
      transporter = nodemailerClient.createTransport({
        service: 'gmail',
        auth: { user: env.SMTP_USER, pass: env.SMTP_APP_PASSWORD.replace(/\s/g, '') },
      });
    }

    const copy = purposeCopy[purpose] || purposeCopy.LOGIN;
    const safeCode = escapeHtml(code);
    try {
      const result = await transporter.sendMail({
        from: `Wrapchik <${env.SMTP_USER}>`,
        to,
        subject: copy.subject,
        html: `<!doctype html><html><body style="margin:0;background:#fff8f3;font-family:Arial,sans-serif;color:#242b37"><div style="max-width:520px;margin:32px auto;padding:28px;background:#fff;border:1px solid #f0e5de;border-radius:18px"><div style="display:inline-block;background:#ff5722;color:#fff;border-radius:14px;padding:10px 14px;font-size:22px;font-weight:800">W</div><p style="color:#ff5722;font-size:12px;font-weight:800;letter-spacing:2px">WRAPCHIK</p><h1 style="font-size:24px">${copy.heading}</h1><p>Use this one-time verification code:</p><p style="display:inline-block;background:#fff2eb;border-radius:12px;padding:14px 20px;color:#ff5722;font-size:30px;font-weight:800;letter-spacing:8px">${safeCode}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p><p style="color:#697386;font-size:12px">For your security, do not share this code with anyone.</p></div></body></html>`,
        text: `${copy.heading}\n\nYour Wrapchik verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email. Do not share this code.`,
      });
      if (!result?.messageId) throw new Error('SMTP did not confirm the message.');
      console.info('[Gmail SMTP OTP] Provider accepted verification email', { purpose });
      return { id: result.messageId };
    } catch (error) {
      console.error('[Gmail SMTP OTP] Delivery failed', {
        code: /^[A-Za-z0-9_.-]{1,60}$/.test(error?.code || '') ? error.code : undefined,
        command: /^[A-Z0-9_]{1,40}$/i.test(error?.command || '') ? error.command : undefined,
      });
      const deliveryError = new Error('The Gmail mail service could not send the verification email. Check the Gmail app password and server network access.');
      deliveryError.statusCode = 502;
      throw deliveryError;
    }
  };

  return { sendOtpEmail };
};

module.exports = { createGmailSmtpEmailService };
