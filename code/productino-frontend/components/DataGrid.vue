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
    <div v-if="title || creatable" class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <div v-if="title" class="kicker">// {{ title.toLowerCase() }}</div>
        <h1 v-if="title" class="m-0 break-words text-2xl font-bold tracking-tight text-white">{{ title }}</h1>
      </div>
      <button v-if="creatable" class="btn-primary w-full sm:w-auto" @click="emit('create')">{{ createLabel }}</button>
    </div>

    <div class="hidden overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900 sm:block">
      <table class="w-full min-w-max border-collapse">
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

    <div class="grid gap-3 sm:hidden">
      <div
        v-if="!rows.length"
        class="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-500"
      >
        {{ emptyText }}
      </div>

      <article
        v-for="row in rows"
        :key="row.id"
        class="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
        :class="clickable ? 'cursor-pointer active:border-brand/50' : ''"
        @click="clickable && emit('view', row)"
      >
        <dl class="m-0 grid gap-3">
          <div v-for="c in columns" :key="c.key" class="min-w-0">
            <dt class="font-mono text-[10px] uppercase tracking-wide text-neutral-500">{{ c.label }}</dt>
            <dd
              class="m-0 mt-0.5 break-words text-sm text-neutral-200"
              :class="c.align === 'right' ? 'font-mono' : ''"
            >
              {{ row[c.key] ?? '—' }}
            </dd>
          </div>
        </dl>

        <div v-if="hasActions" class="mt-4 flex flex-wrap gap-2 border-t border-neutral-800 pt-3" @click.stop>
          <button v-if="clickable" class="btn-ghost min-h-10 flex-1 basis-28" @click="emit('view', row)">View</button>
          <button v-if="editable" class="btn-ghost min-h-10 flex-1 basis-28" @click="emit('edit', row)">Edit</button>
          <button
            v-for="a in extraActions"
            :key="a.key"
            class="btn-ghost min-h-10 flex-1 basis-28"
            :class="a.variant === 'brand' ? 'border-brand/50 text-brand' : a.variant === 'danger' ? 'border-red-900/60 text-red-400' : ''"
            @click="emit('action', { key: a.key, row })"
          >
            {{ a.label }}
          </button>
          <button v-if="deletable" class="btn-danger min-h-10 flex-1 basis-28" @click="emit('remove', row)">
            Delete
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
