import dotenv from 'dotenv';

dotenv.config();

export const config = Object.freeze({
  port: Number(process.env.PORT || 3000),
  corsOrigins: process.env.CORS_ORIGIN?.split(',').map((value) => value.trim()).filter(Boolean) ?? [],
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN || ''
});
