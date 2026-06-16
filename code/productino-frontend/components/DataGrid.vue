<script setup lang="ts">
interface Column {
  key: string;
  label: string;
  // optional alignment for the cell/header (default left)
  align?: 'left' | 'right';
}
interface ExtraAction {
  key: string;
  label: string;
  variant?: 'brand' | 'danger' | 'muted';
}

const props = withDefaults(
  defineProps<{
    title?: string;
    columns: Column[];
    rows: Record<string, any>[];
    creatable?: boolean;
    editable?: boolean;
    deletable?: boolean;
    clickable?: boolean;
    createLabel?: string;
    emptyText?: string;
    extraActions?: ExtraAction[];
  }>(),
  {
    creatable: false,
    editable: false,
    deletable: false,
    clickable: true,
    createLabel: '+ Create',
    emptyText: 'No rows yet.',
    extraActions: () => [],
  },
);

const emit = defineEmits<{
  create: [];
  view: [row: Record<string, any>];
  edit: [row: Record<string, any>];
  remove: [row: Record<string, any>];
  action: [payload: { key: string; row: Record<string, any> }];
}>();

const hasActions = computed(
  () => props.clickable || props.editable || props.deletable || props.extraActions.length > 0,
);

const variantClass: Record<string, string> = {
  brand: 'text-neutral-400 hover:text-brand',
  danger: 'text-red-400 hover:text-red-300',
  muted: 'text-neutral-400 hover:text-neutral-100',
};
</script>

<template>
  <section>
    <div v-if="title || creatable" class="mb-4 flex items-end justify-between">
      <div>
        <div v-if="title" class="kicker">// {{ title.toLowerCase() }}</div>
        <h1 v-if="title" class="m-0 text-2xl font-bold tracking-tight text-white">{{ title }}</h1>
      </div>
      <button v-if="creatable" class="btn-primary" @click="emit('create')">{{ createLabel }}</button>
    </div>

    <div class="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <table class="w-full border-collapse">
        <thead>
          <tr>
            <th
              v-for="c in columns"
              :key="c.key"
              class="border-b border-neutral-800 bg-neutral-900 px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-500"
              :class="c.align === 'right' ? 'text-right' : 'text-left'"
            >
              {{ c.label }}
            </th>
            <th
              v-if="hasActions"
              class="w-px whitespace-nowrap border-b border-neutral-800 bg-neutral-900 px-4 py-2.5 text-right font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-500"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td :colspan="columns.length + (hasActions ? 1 : 0)" class="py-6 text-center text-neutral-500">
              {{ emptyText }}
            </td>
          </tr>
          <tr
            v-for="row in rows"
            :key="row.id"
            class="hover:bg-neutral-800/50"
            :class="clickable ? 'cursor-pointer' : ''"
            @click="clickable && emit('view', row)"
          >
            <td
              v-for="c in columns"
              :key="c.key"
              class="border-b border-neutral-800/70 px-4 py-2.5 align-top text-sm text-neutral-300"
              :class="c.align === 'right' ? 'text-right' : 'text-left'"
            >
              {{ row[c.key] ?? '—' }}
            </td>
            <td
              v-if="hasActions"
              class="whitespace-nowrap border-b border-neutral-800/70 px-4 py-2.5 text-right"
              @click.stop
            >
              <button
                v-if="clickable"
                class="mr-3 text-sm text-neutral-400 hover:text-brand"
                @click="emit('view', row)"
              >
                View
              </button>
              <button
                v-if="editable"
                class="mr-3 text-sm text-neutral-400 hover:text-brand"
                @click="emit('edit', row)"
              >
                Edit
              </button>
              <button
                v-for="a in extraActions"
                :key="a.key"
                class="mr-3 text-sm"
                :class="variantClass[a.variant ?? 'muted']"
                @click="emit('action', { key: a.key, row })"
              >
                {{ a.label }}
              </button>
              <button
                v-if="deletable"
                class="text-sm text-red-400 hover:text-red-300"
                @click="emit('remove', row)"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
