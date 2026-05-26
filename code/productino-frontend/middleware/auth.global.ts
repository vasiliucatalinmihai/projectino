/**
 * Global route guard: send unauthenticated visitors to /login, and keep
 * authenticated users away from /login.
 */
export default defineNuxtRouteMiddleware((to) => {
  const token = useCookie<string | null>('productino_token');
  const loggedIn = !!token.value;

  if (!loggedIn && to.path !== '/login') {
    return navigateTo('/login');
  }
  if (loggedIn && to.path === '/login') {
    return navigateTo('/');
  }
});
