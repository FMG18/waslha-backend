import { SignJWT, jwtVerify } from 'jose';

const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  return new TextEncoder().encode(value);
};

export async function issueAccessToken({ userId, role = 'customer' }) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || '7d')
    .sign(secret());
}

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, secret());
  return { userId: payload.sub, role: payload.role };
}
