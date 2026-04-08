import type { AuthUser } from '@shared/types/auth';
import type { AuthenticatedRequestLike } from '../types/http';

export function getBearerToken(req: AuthenticatedRequestLike): string | null {
  const rawHeader = req.headers.authorization;
  if (!rawHeader) return null;

  const value = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const parts = String(value || '').split(' ');
  return parts.length >= 2 ? parts[1] || null : null;
}

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  return Boolean(user && user.role === 'admin');
}

export function requireAuthenticatedUser(req: AuthenticatedRequestLike): AuthUser | null {
  return req.user || null;
}
