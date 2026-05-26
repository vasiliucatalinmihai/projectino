<script setup lang="ts">
import type { AuthUser } from '~/composables/useAuth';

const { user, logout } = useAuth();

// Load the current user once so every admin page has it available.
const { data: me } = await useAsyncData('me', () => useApi<AuthUser>('/auth/me').catch(() => null));
if (me.value) user.value = me.value;

const canManagePrompts = computed(() => {
  const p = user.value?.permissions ?? [];
  return p.includes('ADMIN') || p.includes('MANAGE_PROMPTS');
});
</script>

<template>
  <div class="min-h-screen">
    <header class="flex items-center gap-8 border-b border-neutral-800 bg-neutral-950 px-6 py-3">
      <NuxtLink to="/projects" class="flex items-center gap-2 no-underline">
        <img src="/mark.svg" alt="" width="28" height="28" class="rounded-md" />
        <strong class="font-mono font-bold tracking-tight text-white"
          >productino<span class="text-brand">.</span></strong
        >
        <span class="font-mono text-[10px] uppercase tracking-wider text-brand">// admin</span>
      </NuxtLink>

      <nav class="flex gap-1">
        <NuxtLink
          to="/projects"
          class="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
          active-class="!text-brand bg-neutral-900"
        >
          Projects
        </NuxtLink>
        <NuxtLink
          to="/settings"
          class="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
          active-class="!text-brand bg-neutral-900"
        >
          Settings
        </NuxtLink>
        <NuxtLink
          v-if="canManagePrompts"
          to="/prompts"
          class="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
          active-class="!text-brand bg-neutral-900"
        >
          Prompts
        </NuxtLink>
      </nav>

      <div v-if="user" class="ml-auto flex items-center gap-3">
        <div class="text-right leading-tight">
          <div class="text-sm font-semibold text-neutral-100">{{ user.email }}</div>
          <div class="font-mono text-[10px] text-brand">
            {{ user.permissions.join(' · ') || 'no permissions' }}
          </div>
        </div>
        <button class="btn-ghost" @click="logout">Log out</button>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-6 py-8">
      <slot />
    </main>
  </div>
</template>
