export interface AuthUser {
  id: number;
  username: string;
  role: string;
  name: string;
}

export interface AuthLoginPayload {
  username: string;
  password: string;
}

export interface AuthLoginResponse {
  token: string;
  user: AuthUser;
}

export interface AuthContextValue {
  currentUser: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (credentials: AuthLoginPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
}
