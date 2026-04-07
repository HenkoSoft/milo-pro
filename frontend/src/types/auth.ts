export interface AuthUser {
  id: number;
  username: string;
  role: string;
  name: string;
  created_at?: string;
}

export interface AuthLoginPayload {
  username: string;
  password: string;
}

export interface AuthLoginResponse {
  token: string;
  user: AuthUser;
}

export interface CreateAuthUserPayload {
  username: string;
  password: string;
  role: string;
  name: string;
}

export interface AuthContextValue {
  currentUser: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (credentials: AuthLoginPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
}
