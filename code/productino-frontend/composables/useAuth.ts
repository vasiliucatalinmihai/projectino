export interface AuthAccount {
  id: number;
  name: string;
  isSystem: boolean;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  accountId: number;
  account: AuthAccount | null;
  permissions: string[];
  isSuperAdmin: boolean;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

const TOKEN_COOKIE = 'productino_token';
// While impersonating, the original super-admin token is stashed here so we can
// switch back.
const SUPER_COOKIE = 'productino_super_token';

export function useAuth() {
  const config = useRuntimeConfig();
  const base = import.meta.server ? config.apiBaseInternal : config.public.apiBase;

  // Cookies are readable on both server (SSR) and client.
  const cookieOpts = { maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' as const, path: '/' };
  const token = useCookie<string | null>(TOKEN_COOKIE, cookieOpts);
  const superToken = useCookie<string | null>(SUPER_COOKIE, cookieOpts);
  const user = useState<AuthUser | null>('auth_user', () => null);

  async function login(email: string, password: string): Promise<void> {
    const res = await $fetch<LoginResponse>(`${base}/api/auth/login`, {
      method: 'POST',
      body: { email, password },
    });
    superToken.value = null;
    token.value = res.accessToken;
    user.value = res.user;
  }

  function logout(): void {
    token.value = null;
    superToken.value = null;
    user.value = null;
    navigateTo('/login');
  }

  /** Super admin → enter a tenant. Stashes the super token and reloads as them. */
  async function impersonate(accountId: number): Promise<void> {
    const res = await useApi<LoginResponse>(`/accounts/${accountId}/impersonate`, {
      method: 'POST',
    });
    superToken.value = token.value; // keep the super session to return to
    token.value = res.accessToken;
    user.value = res.user;
    if (import.meta.client) window.location.assign('/');
  }

  /** Return from an impersonated session back to the super-admin session. */
  function stopImpersonating(): void {
    if (!superToken.value) return;
    token.value = superToken.value;
    superToken.value = null;
    user.value = null;
    if (import.meta.client) window.location.assign('/');
  }

  const isAuthenticated = computed(() => !!token.value);
  const isImpersonating = computed(() => !!superToken.value);

  return {
    token,
    user,
    login,
    logout,
    impersonate,
    stopImpersonating,
    isAuthenticated,
    isImpersonating,
  };
}
