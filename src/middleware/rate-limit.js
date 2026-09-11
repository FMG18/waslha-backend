const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 10, key = (req) => req.ip || 'unknown' } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const bucketKey = String(key(req));
    const current = buckets.get(bucketKey);
    if (!current || current.resetAt <= now) {
      buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, message: 'محاولات كثيرة. حاول لاحقًا.' });
    }
    next();
  };
}
