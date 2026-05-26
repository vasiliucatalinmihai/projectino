<script setup lang="ts">
interface Column {
  key: string;
  label: string;
}

defineProps<{
  title: string;
  columns: Column[];
  rows: Record<string, any>[];
}>();

const emit = defineEmits<{
  create: [];
  view: [row: Record<string, any>];
  edit: [row: Record<string, any>];
  remove: [row: Record<string, any>];
}>();
</script>

<template>
  <section>
    <div class="mb-4 flex items-end justify-between">
      <div>
        <div class="kicker">// {{ title.toLowerCase() }}</div>
        <h1 class="m-0 text-2xl font-bold tracking-tight text-white">{{ title }}</h1>
      </div>
      <button class="btn-primary" @click="emit('create')">+ Create</button>
    </div>

    <div class="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <table class="w-full border-collapse">
        <thead>
          <tr>
            <th
              v-for="c in columns"
              :key="c.key"
              class="border-b border-neutral-800 bg-neutral-900 px-4 py-2.5 text-left font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-500"
            >
              {{ c.label }}
            </th>
            <th
              class="w-px whitespace-nowrap border-b border-neutral-800 bg-neutral-900 px-4 py-2.5 text-right font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-500"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td :colspan="columns.length + 1" class="py-6 text-center text-neutral-500">
              No rows yet.
            </td>
          </tr>
          <tr
            v-for="row in rows"
            :key="row.id"
            class="cursor-pointer hover:bg-neutral-800/50"
            @click="emit('view', row)"
          >
            <td
              v-for="c in columns"
              :key="c.key"
              class="border-b border-neutral-800/70 px-4 py-2.5 align-top text-sm text-neutral-300"
            >
              {{ row[c.key] ?? '—' }}
            </td>
            <td
              class="whitespace-nowrap border-b border-neutral-800/70 px-4 py-2.5 text-right"
              @click.stop
            >
              <button class="mr-3 text-sm text-neutral-400 hover:text-brand" @click="emit('view', row)">
                View
              </button>
              <button class="mr-3 text-sm text-neutral-400 hover:text-brand" @click="emit('edit', row)">
                Edit
              </button>
              <button class="text-sm text-red-400 hover:text-red-300" @click="emit('remove', row)">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
