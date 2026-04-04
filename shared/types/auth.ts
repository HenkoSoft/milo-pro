export interface AuthUser {
  id: number;
  username: string;
  role: string;
  name: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface MeResponse extends AuthUser {}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: string;
  name: string;
}

export interface UserListItem extends AuthUser {
  created_at?: string;
}
