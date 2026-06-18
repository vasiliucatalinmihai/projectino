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
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[6vh] sm:pt-[8vh]"
    @click.self="emit('close')"
  >
    <div
      class="flex max-h-[88vh] w-full flex-col rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl"
      :class="widthClass"
    >
      <header class="flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-3.5">
        <h3 class="m-0 text-base font-semibold text-white">{{ title }}</h3>
        <button class="text-neutral-500 hover:text-neutral-200" @click="emit('close')">✕</button>
      </header>
      <div class="overflow-y-auto p-5">
        <slot />
      </div>
    </div>
  </div>
</template>
