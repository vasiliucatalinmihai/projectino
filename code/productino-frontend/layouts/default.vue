<script setup lang="ts">
import type { AuthUser } from '~/composables/useAuth';

const { user, logout, isImpersonating, stopImpersonating } = useAuth();

// Load the current user once so every admin page has it available.
const { data: me } = await useAsyncData('me', () => useApi<AuthUser>('/auth/me').catch(() => null));
if (me.value) user.value = me.value;

const isSuperAdmin = computed(() => !!user.value?.isSuperAdmin);

// Collapsed state persisted in a cookie so it's stable across SSR + navigation.
const collapsed = useCookie<boolean>('productino_nav_collapsed', {
  default: () => false,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/',
});
function toggleNav() {
  collapsed.value = !collapsed.value;
}

// Outline icon paths (Heroicons, 24×24, currentColor stroke).
const ICONS: Record<string, string[]> = {
  accounts: [
    'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  ],
  clients: [
    'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  ],
  users: [
    'M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  ],
  projects: [
    'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z',
  ],
  prompts: [
    'm6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z',
  ],
  settings: [
    'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z',
    'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  ],
  account: [
    'M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0ZM10.5 14.25a3.75 3.75 0 0 0-7.5 0v.75h7.5v-.75Z',
  ],
  'ai-models': [
    'M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z',
  ],
};

// Friendly labels where simple capitalization isn't enough.
const LABELS: Record<string, string> = { 'ai-models': 'AI Models' };

function toItems(keys: string[]) {
  return keys.map((k) => ({
    to: `/${k}`,
    label: LABELS[k] ?? k.charAt(0).toUpperCase() + k.slice(1),
    icon: ICONS[k],
  }));
}

// Two groups: primary nav up top, settings-like items pinned to the bottom.
const topNav = computed(() =>
  toItems(isSuperAdmin.value ? ['accounts', 'clients', 'projects'] : ['clients', 'projects']),
);
const bottomNav = computed(() =>
  toItems(
    isSuperAdmin.value ? ['prompts', 'settings', 'account'] : ['users', 'ai-models', 'account'],
  ),
);
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <!-- Impersonation banner -->
    <div
      v-if="isImpersonating"
      class="flex items-center justify-center gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300"
    >
      <span class="font-mono text-xs uppercase tracking-wider">// impersonating</span>
      <span>Viewing as <strong>{{ user?.account?.name ?? user?.email }}</strong></span>
      <button
        class="rounded-md border border-amber-400/50 px-2 py-0.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
        @click="stopImpersonating"
      >
        Return to super admin
      </button>
    </div>

    <!-- Header: logo + app name on the left, user + logout on the right -->
    <header
      class="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3"
    >
      <NuxtLink to="/projects" class="flex items-center gap-2 no-underline">
        <img src="/mark.svg" alt="" width="28" height="28" class="rounded-md" />
        <strong class="font-mono font-bold tracking-tight text-white"
          >productino<span class="text-brand">.</span></strong
        >
        <span class="font-mono text-[10px] uppercase tracking-wider text-brand">// admin</span>
      </NuxtLink>

      <div v-if="user" class="flex items-center gap-3">
        <div class="text-right leading-tight">
          <div class="flex items-center justify-end gap-2">
            <span class="text-sm font-semibold text-neutral-100">{{ user.email }}</span>
            <span
              v-if="isSuperAdmin"
              class="rounded border border-brand/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-brand"
              >super</span
            >
          </div>
          <div class="font-mono text-[10px] text-neutral-500">
            <span class="text-neutral-400">{{ user.account?.name ?? '—' }}</span>
            · {{ user.permissions.join(' · ') || 'no permissions' }}
          </div>
        </div>
        <button class="btn-ghost" @click="logout">Log out</button>
      </div>
    </header>

    <!-- Body: collapsible left sidebar menu + main content -->
    <div class="flex flex-1">
      <aside
        class="flex flex-col border-r border-neutral-800 bg-neutral-950 py-4 transition-all duration-200"
        :class="collapsed ? 'w-16 px-2' : 'w-52 px-4'"
      >
        <div class="mb-2 flex items-center" :class="collapsed ? 'justify-center' : 'justify-between px-2'">
          <div v-if="!collapsed" class="kicker">// menu</div>
          <button
            class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
            :title="collapsed ? 'Expand menu' : 'Collapse menu'"
            @click="toggleNav"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.8"
              stroke="currentColor"
              class="h-4 w-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                :d="collapsed ? 'm8.25 4.5 7.5 7.5-7.5 7.5' : 'M15.75 19.5 8.25 12l7.5-7.5'"
              />
            </svg>
          </button>
        </div>

        <nav class="flex flex-col gap-1">
          <NavLink v-for="item in topNav" :key="item.to" :item="item" :collapsed="collapsed" />
        </nav>

        <!-- Settings-like items pinned to the bottom -->
        <nav class="mt-auto flex flex-col gap-1 border-t border-neutral-800 pt-3">
          <NavLink v-for="item in bottomNav" :key="item.to" :item="item" :collapsed="collapsed" />
        </nav>
      </aside>

      <main class="flex-1 px-6 py-8">
        <div class="mx-auto max-w-5xl">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
