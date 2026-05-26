<script setup lang="ts">
defineProps<{ title: string }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[8vh]"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl">
      <header class="flex items-center justify-between border-b border-neutral-800 px-5 py-3.5">
        <h3 class="m-0 text-base font-semibold text-white">{{ title }}</h3>
        <button class="text-neutral-500 hover:text-neutral-200" @click="emit('close')">✕</button>
      </header>
      <div class="p-5">
        <slot />
      </div>
    </div>
  </div>
</template>
