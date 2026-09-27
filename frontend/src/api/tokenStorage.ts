const STORAGE_KEY = 'helpdesk.auth.token';

const readStoredToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

let currentToken: string | null = readStoredToken();

export const getToken = (): string | null => currentToken;

export const setToken = (token: string): void => {
  currentToken = token;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage unavailable (private mode, disabled cookies): session stays in-memory only.
  }
};

export const clearToken = (): void => {
  currentToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};
