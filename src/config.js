import dotenv from 'dotenv';

dotenv.config();

// OAuth Web Client ID is public configuration. Keep an environment override for
// deployments, with the Firebase project's known client ID as a safe fallback.
const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '402670996635-cojr4khl41le3ermkojkojdkv03arpd6.apps.googleusercontent.com';

export const config = Object.freeze({
  port: Number(process.env.PORT || 3000),
  corsOrigins: process.env.CORS_ORIGIN?.split(',').map((value) => value.trim()).filter(Boolean) ?? [],
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN || '',
  googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID
});
