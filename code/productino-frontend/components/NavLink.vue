<script setup lang="ts">
defineProps<{
  item: { to: string; label: string; icon: string[] };
  collapsed: boolean;
}>();
</script>

<template>
  <NuxtLink
    :to="item.to"
    :title="collapsed ? item.label : undefined"
    class="flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
    :class="collapsed ? 'justify-center' : 'gap-3'"
    active-class="!text-brand bg-neutral-900"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="h-5 w-5 shrink-0"
    >
      <path
        v-for="(d, i) in item.icon"
        :key="i"
        stroke-linecap="round"
        stroke-linejoin="round"
        :d="d"
      />
    </svg>
    <span v-if="!collapsed">{{ item.label }}</span>
  </NuxtLink>
</template>
