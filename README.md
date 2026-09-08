# وصلها — Waslha Backend

Backend for the Waslha taxi-only Android application.

## Current architecture
- Express API under `/api/v1`
- Phone OTP authentication
- Signed JWT access tokens
- MongoDB persistence with in-memory fallback for local development
- Trip lifecycle/state machine
- Driver discovery and availability
- Fare estimation
- Ratings, notifications and support modules

## Production environment
Required for production authentication and persistence:
- `JWT_SECRET` — minimum 32 characters
- `DATABASE_URL` — MongoDB connection string
- `DATABASE_NAME` — database name, defaults to `waslha`
- `CORS_ORIGIN` — comma-separated allowed origins
- `NODE_ENV=production`

## Branch policy
`main` is the only branch. No development branches are used.
