export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  permissions: string[];
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

const TOKEN_COOKIE = 'productino_token';

export function useAuth() {
  const config = useRuntimeConfig();
  const base = import.meta.server ? config.apiBaseInternal : config.public.apiBase;

  // Cookie is readable on both server (SSR) and client.
  const token = useCookie<string | null>(TOKEN_COOKIE, {
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
    path: '/',
  });
  const user = useState<AuthUser | null>('auth_user', () => null);

  async function login(email: string, password: string): Promise<void> {
    const res = await $fetch<LoginResponse>(`${base}/api/auth/login`, {
      method: 'POST',
      body: { email, password },
    });
    token.value = res.accessToken;
    user.value = res.user;
  }

  function logout(): void {
    token.value = null;
    user.value = null;
    navigateTo('/login');
  }

  const isAuthenticated = computed(() => !!token.value);

  return { token, user, login, logout, isAuthenticated };
}
