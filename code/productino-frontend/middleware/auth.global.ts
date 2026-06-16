/**
 * Global route guard: send unauthenticated visitors to /login, and keep
 * authenticated users away from /login.
 */
// Routes that are reachable without being logged in (`/` is the public landing page).
const PUBLIC = (path: string) => path === '/' || path === '/login' || path.startsWith('/activate');

export default defineNuxtRouteMiddleware((to) => {
  const token = useCookie<string | null>('productino_token');
  const loggedIn = !!token.value;

  if (!loggedIn && !PUBLIC(to.path)) {
    return navigateTo('/login');
  }
  if (loggedIn && to.path === '/login') {
    return navigateTo('/');
  }
});
