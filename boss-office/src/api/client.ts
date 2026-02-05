import type { ApiError } from '../types/index.ts';

// API base URL - always use Railway backend (no local backend needed)
const BASE_URL = 'https://the-system-production.up.railway.app/api';

// Custom error class for API errors
export class ApiClientError extends Error {
  public readonly status: number;
  public readonly statusText: string;

  constructor(message: string, status: number, statusText: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.statusText = statusText;
  }
}

// Request options
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

// Generic fetch wrapper with type safety
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const url = `${BASE_URL}${endpoint}`;

  // Log request in development
  if (import.meta.env.DEV) {
    console.log(`[API] ${method} ${url}`, body ? { body } : '');
  }

  try {
    const response = await fetch(url, config);

    // Parse response body
    let data: T | ApiError;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text() as unknown as T;
    }

    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`[API] Response ${response.status}`, data);
    }

    // Handle error responses
    if (!response.ok) {
      const errorData = data as ApiError;
      throw new ApiClientError(
        errorData.message || errorData.error || 'Unknown error',
        response.status,
        response.statusText
      );
    }

    return data as T;
  } catch (error) {
    // Re-throw ApiClientError
    if (error instanceof ApiClientError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiClientError('Network error - unable to reach server', 0, 'Network Error');
    }

    // Handle other errors
    throw new ApiClientError(
      error instanceof Error ? error.message : 'Unknown error',
      0,
      'Error'
    );
  }
}

// HTTP method helpers
export const api = {
  get: <T>(endpoint: string, headers?: Record<string, string>) =>
    request<T>(endpoint, { method: 'GET', headers }),

  post: <T>(endpoint: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(endpoint, { method: 'POST', body, headers }),

  put: <T>(endpoint: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(endpoint, { method: 'PUT', body, headers }),

  patch: <T>(endpoint: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(endpoint, { method: 'PATCH', body, headers }),

  delete: <T>(endpoint: string, headers?: Record<string, string>) =>
    request<T>(endpoint, { method: 'DELETE', headers }),
};
