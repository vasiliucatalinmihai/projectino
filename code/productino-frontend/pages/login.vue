<script setup lang="ts">
definePageMeta({ layout: false });

const { login, user } = useAuth();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const steps = ['Brief', 'Discover', 'Define', 'Plan', 'Deliver'];

async function onSubmit() {
  error.value = '';
  loading.value = true;
  try {
    await login(email.value, password.value);
    // Super admins land on the dashboard; everyone else on their projects.
    await navigateTo(user.value?.isSuperAdmin ? '/dashboard' : '/projects');
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Login failed';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-8">
    <div class="flex w-full max-w-[520px] flex-col items-center gap-7">
      <!-- Branding + pitch -->
      <div class="text-center">
        <img src="/mark.svg" alt="Productino" width="84" height="84" class="mx-auto rounded-2xl" />
        <div class="kicker mt-4">// ai-assisted discovery</div>
        <h1 class="mt-1 font-mono text-3xl font-extrabold tracking-tight text-white">
          productino<span class="text-brand">.</span>
        </h1>
        <p class="mt-2 text-lg font-semibold text-neutral-100">From brief to delivery.</p>
        <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-400">
          Productino reads your client briefing, surfaces the gaps, and asks the right
          questions — then turns the answers into a product definition, tasks and a roadmap.
        </p>

        <!-- Brief → Deliver animation -->
        <div class="mt-6 flex flex-wrap items-center justify-center" aria-hidden="true">
          <template v-for="(step, i) in steps" :key="step">
            <div
              class="step flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-semibold"
              :style="{ '--i': i }"
            >
              <span class="dot h-2 w-2 rounded-full bg-neutral-700" :style="{ '--i': i }" />
              {{ step }}
            </div>
            <span v-if="i < steps.length - 1" class="conn h-0.5 w-6 rounded" />
          </template>
        </div>
      </div>

      <!-- Login form -->
      <form
        class="flex w-full flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6"
        @submit.prevent="onSubmit"
      >
        <h2 class="m-0 mb-1 text-base font-semibold text-white">Sign in</h2>
        <label class="field">
          Email
          <input v-model="email" type="email" class="inp" required autocomplete="username" />
        </label>
        <label class="field">
          Password
          <input
            v-model="password"
            type="password"
            class="inp"
            required
            autocomplete="current-password"
          />
        </label>
        <p v-if="error" class="m-0 text-sm text-red-400">{{ error }}</p>
        <button :disabled="loading" type="submit" class="btn-primary mt-1 w-full">
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
/* Sequential "brief → deliver" pulse — terminal green on dark. */
.step {
  animation: chip 4.5s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.9s);
}
.dot {
  animation: dot 4.5s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.9s);
}
.conn {
  background-image: linear-gradient(
    90deg,
    #262626 0%,
    #262626 38%,
    #4ade80 50%,
    #262626 62%,
    #262626 100%
  );
  background-size: 250% 100%;
  animation: flow 1.7s linear infinite;
}
@keyframes chip {
  0%, 55%, 100% {
    border-color: #262626;
    color: #737373;
    transform: translateY(0);
  }
  12% {
    border-color: #4ade80;
    color: #4ade80;
    transform: translateY(-2px);
  }
}
@keyframes dot {
  0%, 55%, 100% {
    background: #404040;
    transform: scale(1);
  }
  12% {
    background: #4ade80;
    transform: scale(1.5);
  }
}
@keyframes flow {
  0% {
    background-position: 250% 0;
  }
  100% {
    background-position: -250% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .step,
  .dot,
  .conn {
    animation: none;
  }
}
</style>
