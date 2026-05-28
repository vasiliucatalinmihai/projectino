<script setup lang="ts">
import type { AuthUser } from '~/composables/useAuth';

definePageMeta({ layout: false });

interface ActivateResponse {
  accessToken: string;
  user: AuthUser;
}

const route = useRoute();
const token = String(route.params.token ?? '');
const { user } = useAuth();
const activeCookie = useCookie<string | null>('productino_token', {
  maxAge: 60 * 60 * 24 * 7,
  sameSite: 'lax',
  path: '/',
});

const password = ref('');
const confirm = ref('');
const saving = ref(false);
const error = ref('');

async function activate() {
  error.value = '';
  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters.';
    return;
  }
  if (password.value !== confirm.value) {
    error.value = "Passwords don't match.";
    return;
  }
  saving.value = true;
  try {
    const res = await useApi<ActivateResponse>('/auth/activate', {
      method: 'POST',
      body: { token, password: password.value },
    });
    activeCookie.value = res.accessToken;
    user.value = res.user;
    if (import.meta.client) window.location.assign('/');
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Activation failed';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-neutral-950 px-6 py-8">
    <div class="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <div class="mb-4 flex items-center gap-2">
        <img src="/mark.svg" alt="" width="28" height="28" class="rounded-md" />
        <strong class="font-mono font-bold tracking-tight text-white"
          >productino<span class="text-brand">.</span></strong
        >
        <span class="font-mono text-[10px] uppercase tracking-wider text-brand">// activate</span>
      </div>

      <h1 class="m-0 mb-1 text-xl font-bold text-white">Set your password</h1>
      <p class="mb-5 text-sm text-neutral-400">
        Choose a password to activate your account. You'll be logged in right after.
      </p>

      <form class="flex flex-col gap-3" @submit.prevent="activate">
        <label class="field">
          New password
          <input
            v-model="password"
            type="password"
            class="inp"
            required
            minlength="6"
            autocomplete="new-password"
          />
        </label>
        <label class="field">
          Confirm password
          <input
            v-model="confirm"
            type="password"
            class="inp"
            required
            minlength="6"
            autocomplete="new-password"
          />
        </label>
        <p v-if="error" class="m-0 text-sm text-red-400">{{ error }}</p>
        <button type="submit" class="btn-primary mt-1" :disabled="saving">
          {{ saving ? 'Activating…' : 'Activate account' }}
        </button>
      </form>
    </div>
  </div>
</template>
