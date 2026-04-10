import type { AuthenticatedRequestLike } from '../types/http';

const jwt = require('jsonwebtoken');

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-this-secret';

export function getBearerToken(authHeader: string | string[] | undefined | null) {
  if (!authHeader) return null;
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const parts = String(headerValue || '').split(' ');
  return parts.length >= 2 ? parts[1] || null : null;
}

export function authenticate(
  req: AuthenticatedRequestLike & { headers: Record<string, string | string[] | undefined> },
  res: { status: (code: number) => { json: (body: unknown) => void } },
  next: () => void
) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: 'No token' });
    return;
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
