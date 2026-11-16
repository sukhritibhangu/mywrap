const { Resend } = require('resend');

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const purposeCopy = {
  SIGNUP: { subject: 'Verify your Wrapchik student account', heading: 'Create your Wrapchik account' },
  LOGIN: { subject: 'Your Wrapchik sign-in code', heading: 'Sign in to Wrapchik' },
  EMAIL_VERIFY: { subject: 'Verify your Wrapchik email', heading: 'Verify your email' },
  PASSWORD_RESET: { subject: 'Reset your Wrapchik password', heading: 'Reset your password' },
};

const safeProviderMessage = (value) => String(value || 'Provider rejected the request.')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
  .replace(/\b(?:re|rzp|cf)_[A-Za-z0-9_-]{8,}\b/gi, '[secret]')
  .replace(/\bBearer\s+\S+/gi, 'Bearer [token]')
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token]')
  .replace(/\b\d{6}\b/g, '[code]')
  .slice(0, 300);

const createResendEmailService = ({ ResendClient = Resend, getEnv = () => process.env } = {}) => {
  let cachedKey = null;
  let client = null;

  const sendOtpEmail = async ({ to, code, purpose }) => {
    const env = getEnv();
    if (!env.RESEND_API_KEY) {
      const error = new Error('Email delivery is not configured.');
      error.statusCode = 503;
      throw error;
    }
    if (!env.EMAIL_FROM) {
      const error = new Error('Email sender is not configured.');
      error.statusCode = 503;
      throw error;
    }

    if (!client || cachedKey !== env.RESEND_API_KEY) {
      cachedKey = env.RESEND_API_KEY;
      client = new ResendClient(cachedKey);
    }

    const copy = purposeCopy[purpose] || purposeCopy.LOGIN;
    const safeCode = escapeHtml(code);
    let result;
    console.info('[Resend OTP] Sending verification email', { purpose });
    try {
      result = await client.emails.send({
        from: env.EMAIL_FROM,
        to: [to],
        subject: copy.subject,
        html: `<!doctype html><html><body style="margin:0;background:#fff8f3;font-family:Arial,sans-serif;color:#242b37"><div style="max-width:520px;margin:32px auto;padding:28px;background:#fff;border:1px solid #f0e5de;border-radius:18px"><div style="display:inline-block;background:#ff5722;color:#fff;border-radius:14px;padding:10px 14px;font-size:22px;font-weight:800">W</div><p style="color:#ff5722;font-size:12px;font-weight:800;letter-spacing:2px">WRAPCHIK</p><h1 style="font-size:24px">${copy.heading}</h1><p>Use this one-time verification code:</p><p style="display:inline-block;background:#fff2eb;border-radius:12px;padding:14px 20px;color:#ff5722;font-size:30px;font-weight:800;letter-spacing:8px">${safeCode}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p><p style="color:#697386;font-size:12px">For your security, do not share this code with anyone.</p></div></body></html>`,
        text: `${copy.heading}\n\nYour Wrapchik verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email. Do not share this code.`,
      });
    } catch (error) {
      // Log only allow-listed diagnostic fields; SDK messages may contain personal data.
      console.error('[Resend OTP] Provider request failed', {
        name: /^[A-Za-z0-9_.-]{1,60}$/.test(error?.name || '') ? error.name : 'Error',
        code: /^[A-Za-z0-9_.-]{1,60}$/.test(error?.code || '') ? error.code : undefined,
        status: Number.isInteger(error?.statusCode) ? error.statusCode : undefined,
        detail: safeProviderMessage(error?.message),
      });
      const deliveryError = new Error('The email provider could not accept the verification email.');
      deliveryError.statusCode = 502;
      throw deliveryError;
    }

    if (result?.error || !result?.data) {
      console.error('[Resend OTP] Provider rejected verification email', {
        name: /^[A-Za-z0-9_.-]{1,60}$/.test(result?.error?.name || '') ? result.error.name : undefined,
        code: /^[A-Za-z0-9_.-]{1,60}$/.test(result?.error?.code || '') ? result.error.code : undefined,
        status: Number.isInteger(result?.error?.statusCode) ? result.error.statusCode : undefined,
        detail: safeProviderMessage(result?.error?.message),
      });
      const deliveryError = new Error('The email provider could not accept the verification email.');
      deliveryError.statusCode = 502;
      throw deliveryError;
    }

    console.info('[Resend OTP] Provider accepted verification email', { messageId: result.data.id });
    return { id: result.data.id };
  };

  return { sendOtpEmail };
};

module.exports = { createResendEmailService };
