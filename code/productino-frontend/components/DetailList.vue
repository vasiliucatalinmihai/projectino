<script setup lang="ts">
interface Item {
  label: string;
  value: string | number | null | undefined;
  // render the value with preserved whitespace (e.g. multi-line briefings)
  pre?: boolean;
  // render the value in the brand monospace style (e.g. permission keys)
  mono?: boolean;
}

defineProps<{
  items: Item[];
  labelWidth?: string;
}>();
</script>

<template>
  <dl
    class="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-[var(--label-width)_minmax(0,1fr)]"
    :style="{ '--label-width': labelWidth ?? '110px' }"
  >
    <template v-for="it in items" :key="it.label">
      <dt class="text-xs text-neutral-500">{{ it.label }}</dt>
      <dd
        class="m-0 min-w-0 break-words text-sm text-neutral-200"
        :class="[it.pre ? 'whitespace-pre-wrap' : '', it.mono ? 'font-mono text-brand' : '']"
      >
        {{ it.value === null || it.value === undefined || it.value === '' ? '—' : it.value }}
      </dd>
    </template>
  </dl>
</template>
