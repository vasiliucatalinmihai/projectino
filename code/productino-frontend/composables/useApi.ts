/**
 * Returns the backend base URL appropriate for where the code is running:
 * - on the server (SSR) we reach the backend over the docker network
 * - in the browser we use the host-mapped port
 */
export function useApiBase(): string {
  const config = useRuntimeConfig();
  return import.meta.server ? config.apiBaseInternal : config.public.apiBase;
}

/**
 * Thin wrapper around $fetch that prefixes the API base + /api and attaches the
 * bearer token (if any) so authenticated endpoints work transparently.
 */
export function useApi<T>(path: string, opts: Record<string, any> = {}) {
  const base = useApiBase();
  const token = useCookie<string | null>('productino_token');
  const headers = {
    ...(opts.headers ?? {}),
    ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
  };
  return $fetch<T>(`${base}/api${path}`, { ...opts, headers });
}
