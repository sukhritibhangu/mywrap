const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client();
const getClientId = () => String(process.env.GOOGLE_CLIENT_ID || '').trim();

async function verifyGoogleIdentity(credential) {
  const audience = getClientId();
  if (!audience) throw Object.assign(new Error('Google sign-in is not configured yet.'), { statusCode: 503 });
  const ticket = await client.verifyIdToken({ idToken: credential, audience });
  const payload = ticket.getPayload();
  if (!payload || payload.hd !== 'thapar.edu' || payload.email_verified !== true
      || !/^[^\s@]+@thapar\.edu$/.test(payload.email || '')
      || typeof payload.sub !== 'string' || !payload.sub) {
    throw Object.assign(new Error('Use your Thapar Google account (@thapar.edu).'), { statusCode: 403 });
  }
  return payload;
}

module.exports = { getClientId, verifyGoogleIdentity };
