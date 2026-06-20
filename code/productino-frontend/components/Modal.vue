<script setup lang="ts">
const props = withDefaults(
  defineProps<{ title: string; size?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' }>(),
  { size: 'md' },
);
const emit = defineEmits<{ close: [] }>();

const widthClass = computed(
  () =>
    ({
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      '2xl': 'max-w-2xl',
      '3xl': 'max-w-3xl',
    })[props.size],
);
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-3 pt-[4vh] sm:px-4 sm:pt-[8vh]"
    @click.self="emit('close')"
  >
    <div
      class="flex max-h-[88vh] w-full flex-col rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl"
      :class="widthClass"
    >
      <header class="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3.5 sm:px-5">
        <h3 class="m-0 min-w-0 break-words text-base font-semibold text-white">{{ title }}</h3>
        <button class="text-neutral-500 hover:text-neutral-200" @click="emit('close')">✕</button>
      </header>
      <div class="overflow-y-auto p-4 sm:p-5">
        <slot />
      </div>
    </div>
  </div>
</template>
