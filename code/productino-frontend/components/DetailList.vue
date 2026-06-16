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
  <dl class="grid gap-x-3 gap-y-2" :style="{ gridTemplateColumns: `${labelWidth ?? '110px'} 1fr` }">
    <template v-for="it in items" :key="it.label">
      <dt class="text-xs text-neutral-500">{{ it.label }}</dt>
      <dd
        class="m-0 text-sm text-neutral-200"
        :class="[it.pre ? 'whitespace-pre-wrap' : '', it.mono ? 'font-mono text-brand' : '']"
      >
        {{ it.value === null || it.value === undefined || it.value === '' ? '—' : it.value }}
      </dd>
    </template>
  </dl>
</template>
