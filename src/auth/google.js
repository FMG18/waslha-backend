import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';

const client = new OAuth2Client();

export async function verifyGoogleIdToken(idToken) {
  if (!config.googleWebClientId) {
    const error = new Error('GOOGLE_WEB_CLIENT_ID is not configured');
    error.code = 'GOOGLE_NOT_CONFIGURED';
    throw error;
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: config.googleWebClientId
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    const error = new Error('Google account information is incomplete or unverified');
    error.code = 'GOOGLE_ACCOUNT_INVALID';
    throw error;
  }

  return {
    googleSub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
    name: payload.name || '',
    picture: payload.picture || ''
  };
}
