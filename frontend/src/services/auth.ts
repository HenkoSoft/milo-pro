import { apiRequest } from './client';
import type { AuthLoginPayload, AuthLoginResponse, AuthUser, CreateAuthUserPayload } from '../types/auth';

export function login(payload: AuthLoginPayload) {
  return apiRequest<AuthLoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getCurrentUser(token: string) {
  return apiRequest<AuthUser>('/auth/me', {
    method: 'GET',
    token
  });
}

export function logout(token?: string | null) {
  return apiRequest<{ success: boolean }>('/auth/logout', {
    method: 'POST',
    token
  });
}

export function getUsers() {
  return apiRequest<AuthUser[]>('/auth/users');
}

export function createUser(payload: CreateAuthUserPayload) {
  return apiRequest<AuthUser>('/auth/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
