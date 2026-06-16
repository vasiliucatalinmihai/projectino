<script setup lang="ts">
defineProps<{ account: string; error?: string | null }>();
const emit = defineEmits<{ confirm: []; close: [] }>();
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh]"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-md overflow-hidden rounded-xl border border-amber-500/40 bg-neutral-900 shadow-2xl">
      <header
        class="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-5 py-3.5"
      >
        <span class="font-mono text-xs uppercase tracking-wider text-amber-300">// impersonate</span>
        <button class="text-amber-400/70 hover:text-amber-200" @click="emit('close')">✕</button>
      </header>

      <div class="p-5">
        <p class="m-0 text-sm text-neutral-200">
          Sign in as <strong class="text-amber-300">{{ account }}</strong>?
        </p>
        <p class="mt-2 text-sm text-neutral-400">
          You'll be signed in as one of its admins. A banner stays at the top so you can return to
          your super-admin session at any time.
        </p>

        <p
          v-if="error"
          class="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
        >
          {{ error }}
        </p>

        <div class="mt-5 flex justify-end gap-2">
          <button class="btn-ghost" @click="emit('close')">{{ error ? 'Close' : 'Cancel' }}</button>
          <button
            v-if="!error"
            class="rounded-md border border-amber-400/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
            @click="emit('confirm')"
          >
            Impersonate
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
