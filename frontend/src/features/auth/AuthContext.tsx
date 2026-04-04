import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren
} from 'react';
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from '../../api/auth';
import type { AuthContextValue, AuthLoginPayload, AuthUser } from '../../types/auth';

const TOKEN_STORAGE_KEY = 'milo_react_token';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

function writeStoredToken(token: string | null) {
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [isInitializing, setIsInitializing] = useState(true);
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    async function restoreSession() {
      const storedToken = readStoredToken();

      if (!storedToken) {
        setIsInitializing(false);
        return;
      }

      try {
        const user = await getCurrentUser(storedToken);
        setCurrentUser(user);
        setToken(storedToken);
      } catch (_error) {
        writeStoredToken(null);
        setCurrentUser(null);
        setToken(null);
      } finally {
        setIsInitializing(false);
      }
    }

    void restoreSession();
  }, []);

  async function login(credentials: AuthLoginPayload) {
    const response = await loginRequest(credentials);
    writeStoredToken(response.token);
    setToken(response.token);
    setCurrentUser(response.user);
    return response.user;
  }

  async function logout() {
    try {
      await logoutRequest(token);
    } catch (_error) {
      // El backend actual no invalida el token server-side.
    } finally {
      writeStoredToken(null);
      setCurrentUser(null);
      setToken(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        isAuthenticated: Boolean(currentUser && token),
        isInitializing,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
