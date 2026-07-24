const attemptsMap = new Map();

/**
 * Rate limiter middleware for authentication attempts (10 attempts per minute per IP)
 */
function authRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxAttempts = 10;

  let record = attemptsMap.get(ip);
  if (!record || (now - record.startTime) > windowMs) {
    record = { startTime: now, count: 1 };
    attemptsMap.set(ip, record);
  } else {
    record.count++;
  }

  if (record.count > maxAttempts) {
    return res.status(429).json({
      success: false,
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Too many authentication attempts. Please wait 1 minute before trying again.'
    });
  }

  next();
}

module.exports = authRateLimiter;
