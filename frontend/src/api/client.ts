import { getToken } from './tokenStorage';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type UnauthorizedHandler = (token: string | null) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null): void => {
  unauthorizedHandler = handler;
};

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
};

type ErrorPayload = { error?: { code?: string; message?: string; details?: unknown } };

const BASE_URL = '/api';

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Nie można połączyć się z serwerem. Sprawdź połączenie internetowe.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? ((await response.json().catch(() => undefined)) as ErrorPayload | T | undefined)
    : undefined;

  if (!response.ok) {
    if (response.status === 401) unauthorizedHandler?.(token);
    const errorPayload = (payload as ErrorPayload | undefined)?.error;
    throw new ApiError(
      response.status,
      errorPayload?.code ?? 'UNKNOWN_ERROR',
      errorPayload?.message ?? 'Wystąpił nieoczekiwany błąd serwera.',
      errorPayload?.details,
    );
  }

  return payload as T;
}
