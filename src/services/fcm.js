import { GoogleAuth } from 'google-auth-library';

let cachedAuth = null;

function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', error.message);
    return null;
  }
}

async function accessToken() {
  const creds = credentials();
  if (!creds) return null;
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging']
    });
  }
  const client = await cachedAuth.getClient();
  const result = await client.getAccessToken();
  return typeof result === 'string' ? result : result?.token || null;
}

export async function sendPushToUser({ tokens, title, body, data = {} }) {
  const creds = credentials();
  if (!creds || !Array.isArray(tokens) || tokens.length === 0) return { sent: 0, invalidTokens: [] };

  const projectId = process.env.FIREBASE_PROJECT_ID || creds.project_id;
  if (!projectId) return { sent: 0, invalidTokens: [] };
  const bearer = await accessToken();
  if (!bearer) return { sent: 0, invalidTokens: [] };

  const results = await Promise.all(tokens.map(async (token) => {
    try {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: Object.fromEntries(Object.entries(data).map(([key, value]) => [String(key), String(value)])),
            android: { priority: 'HIGH' }
          }
        })
      });
      if (response.ok) return { sent: 1, invalid: false };
      const text = await response.text();
      const invalid = response.status === 404 || text.includes('UNREGISTERED') || text.includes('INVALID_ARGUMENT');
      return { sent: 0, invalid };
    } catch (error) {
      console.warn('FCM send failed:', error.message);
      return { sent: 0, invalid: false };
    }
  }));

  return {
    sent: results.reduce((sum, item) => sum + item.sent, 0),
    invalidTokens: tokens.filter((_token, index) => results[index].invalid)
  };
}
