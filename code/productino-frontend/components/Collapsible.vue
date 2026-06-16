<script setup lang="ts">
// A card section with a clickable header that collapses its body. `large` styles
// it as a top-level section; the `summary` slot shows key info on the header row
// (visible even when collapsed); the `actions` slot holds buttons (right side).
const props = withDefaults(
  defineProps<{ title: string; open?: boolean; count?: number | string; large?: boolean }>(),
  { open: false },
);
const isOpen = ref(props.open);
</script>

<template>
  <div class="rounded-xl border border-neutral-800 bg-neutral-900">
    <div class="flex items-center justify-between gap-3 px-5" :class="large ? 'py-4' : 'py-3'">
      <button
        type="button"
        class="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left"
        @click="isOpen = !isOpen"
      >
        <span
          class="shrink-0 text-neutral-600 transition-transform duration-150"
          :class="isOpen ? 'rotate-90' : ''"
        >▸</span>
        <span
          :class="large
            ? 'text-base font-semibold tracking-tight text-white'
            : 'font-mono text-xs uppercase tracking-wider text-neutral-500'"
        >{{ title }}</span>
        <span
          v-if="count !== undefined && count !== ''"
          class="shrink-0 font-mono text-[10px] text-neutral-600"
        >({{ count }})</span>
        <span class="min-w-0"><slot name="summary" /></span>
      </button>
      <div class="shrink-0"><slot name="actions" /></div>
    </div>
    <div v-show="isOpen" class="border-t border-neutral-800/60 px-5 py-4">
      <slot />
    </div>
  </div>
</template>
