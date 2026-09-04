type RuntimeConfig = { VITE_API_URL?: string };

declare global {
  interface Window {
    __POKA_PRATIKA_CONFIG__?: RuntimeConfig;
  }
}

const apiUrl = window.__POKA_PRATIKA_CONFIG__?.VITE_API_URL || (import.meta.env.VITE_API_URL as string | undefined);

if (!apiUrl) {
  throw new Error('VITE_API_URL precisa estar definida no serviço de frontend da Railway em runtime ou no build do Vite.');
}

const parsedApiUrl = new URL(apiUrl);

if (window.location.protocol === 'https:' && parsedApiUrl.protocol !== 'https:') {
  throw new Error('VITE_API_URL precisa usar HTTPS quando o frontend estiver em HTTPS.');
}

if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsedApiUrl.hostname)) {
  throw new Error('VITE_API_URL não pode apontar para ambiente local em produção.');
}

export const API_URL = parsedApiUrl.origin;

function waitForRetry() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 300));
}

export class ApiClient {
  private token: string | null;
  private onUnauthorized?: () => void;

  constructor(token: string | null, onUnauthorized?: () => void) {
    this.token = token;
    this.onUnauthorized = onUnauthorized;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);

    const method = (options.method ?? 'GET').toUpperCase();
    const maxAttempts = method === 'GET' ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(`${API_URL}${path}`, { ...options, headers });
      } catch {
        if (attempt < maxAttempts) {
          await waitForRetry();
          continue;
        }
        throw new Error('A conexão com o servidor foi interrompida. Tente novamente.');
      }

      const transientStatus = response.status === 502 || response.status === 503 || response.status === 504;
      if (transientStatus && attempt < maxAttempts) {
        await waitForRetry();
        continue;
      }

      let payload: unknown = null;
      if (response.status !== 204) {
        try {
          payload = await response.json();
        } catch {
          if (response.ok && attempt < maxAttempts) {
            await waitForRetry();
            continue;
          }
          if (response.ok) throw new Error('O servidor retornou uma resposta inválida. Tente novamente.');
        }
      }

      if (!response.ok) {
        if (response.status === 401 && this.token) {
          this.token = null;
          this.onUnauthorized?.();
        }
        const errorPayload = payload as { message?: string } | null;
        throw new Error(errorPayload?.message ?? 'Falha na comunicação com o backend.');
      }

      if (payload === null) {
        if (attempt < maxAttempts) {
          await waitForRetry();
          continue;
        }
        throw new Error('O servidor retornou uma resposta vazia. Tente novamente.');
      }

      return payload as T;
    }

    throw new Error('Falha na comunicação com o backend.');
  }
}
