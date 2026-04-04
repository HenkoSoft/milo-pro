export interface ApiRequestOptions extends RequestInit {
  token?: string | null;
}

const API_BASE_URL = '/api';
const TOKEN_STORAGE_KEY = 'milo_react_token';

function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = options.token ?? getStoredToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  let parsedBody: unknown = null;
  const rawText = await response.text();

  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText) as unknown;
    } catch (_error) {
      parsedBody = rawText;
    }
  }

  if (!response.ok) {
    if (typeof parsedBody === 'object' && parsedBody && 'error' in parsedBody) {
      throw new Error(String((parsedBody as { error: string }).error || 'Request failed'));
    }

    if (typeof parsedBody === 'string' && parsedBody.trim()) {
      throw new Error(parsedBody);
    }

    throw new Error(`Request failed with status ${response.status}`);
  }

  return parsedBody as T;
}
