<script setup lang="ts">
import type { ConfirmTone } from '~/composables/useConfirm';

const props = withDefaults(
  defineProps<{
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ConfirmTone;
    singleAction?: boolean;
  }>(),
  { tone: 'neutral', singleAction: false },
);

const emit = defineEmits<{ confirm: []; close: [] }>();

// Tone-driven styling: danger=red, warning=amber, neutral/info=brand green.
const styles = computed(() => {
  switch (props.tone) {
    case 'danger':
      return {
        border: 'border-red-500/40',
        headerBg: 'bg-red-500/10',
        kickerText: 'text-red-300',
        confirmBtn:
          'rounded-md border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-500/20',
      };
    case 'warning':
      return {
        border: 'border-amber-500/40',
        headerBg: 'bg-amber-500/10',
        kickerText: 'text-amber-300',
        confirmBtn:
          'rounded-md border border-amber-400/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20',
      };
    default:
      return {
        border: 'border-neutral-800',
        headerBg: 'bg-neutral-950',
        kickerText: 'text-brand',
        confirmBtn: 'btn-primary',
      };
  }
});
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh]"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-md overflow-hidden rounded-xl border bg-neutral-900 shadow-2xl"
      :class="styles.border"
    >
      <header
        class="flex items-center justify-between border-b px-5 py-3.5"
        :class="[styles.border, styles.headerBg]"
      >
        <div>
          <div class="font-mono text-[10px] uppercase tracking-wider" :class="styles.kickerText">
            // {{ tone === 'danger' ? 'confirm' : tone === 'warning' ? 'heads up' : 'notice' }}
          </div>
          <h3 class="m-0 text-base font-semibold text-white">{{ title }}</h3>
        </div>
        <button class="text-neutral-500 hover:text-neutral-200" @click="emit('close')">✕</button>
      </header>

      <div class="p-5">
        <p v-if="message" class="m-0 whitespace-pre-line text-sm text-neutral-300">{{ message }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button v-if="!singleAction" class="btn-ghost" @click="emit('close')">
            {{ cancelLabel ?? 'Cancel' }}
          </button>
          <button :class="styles.confirmBtn" @click="emit('confirm')">
            {{ confirmLabel ?? 'OK' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
