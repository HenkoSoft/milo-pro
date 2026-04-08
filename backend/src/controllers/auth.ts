import type {
  AuthUser,
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
  MeResponse,
  UserListItem
} from '@shared/types/auth';

interface UserRecordLike {
  id?: unknown;
  username?: unknown;
  role?: unknown;
  name?: unknown;
  created_at?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeLoginRequest(body: unknown): LoginRequest {
  const data = isRecord(body) ? body : {};

  return {
    username: String(data.username || '').trim(),
    password: String(data.password || '')
  };
}

export function normalizeCreateUserRequest(body: unknown): CreateUserRequest {
  const data = isRecord(body) ? body : {};

  return {
    username: String(data.username || '').trim(),
    password: String(data.password || ''),
    role: String(data.role || 'technician').trim(),
    name: String(data.name || '').trim()
  };
}

export function sanitizeAuthUser(user: UserRecordLike): AuthUser {
  return {
    id: Number(user.id || 0),
    username: String(user.username || ''),
    role: String(user.role || ''),
    name: String(user.name || '')
  };
}

export function buildLoginResponse(token: string, user: UserRecordLike): LoginResponse {
  return {
    token,
    user: sanitizeAuthUser(user)
  };
}

export function buildMeResponse(user: UserRecordLike): MeResponse {
  return sanitizeAuthUser(user);
}

export function sanitizeUserListItem(user: UserRecordLike): UserListItem {
  return {
    ...sanitizeAuthUser(user),
    created_at: typeof user.created_at === 'string' ? user.created_at : undefined
  };
}
