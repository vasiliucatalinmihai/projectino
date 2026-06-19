<script setup lang="ts">
interface Stage {
  stage: string;
  count: number;
  pct: number;
}
interface Overview {
  accountCount: number;
  clientCount: number;
  projectCount: number;
  stages: Stage[];
}

const { data: overview } = await useAsyncData<Overview | null>('dashboard-overview', () =>
  useApi<Overview>('/dashboard/overview').catch(() => null),
);

const cards = computed(() => [
  { label: 'Tenant accounts', value: overview.value?.accountCount ?? 0 },
  { label: 'Clients', value: overview.value?.clientCount ?? 0 },
  { label: 'Projects', value: overview.value?.projectCount ?? 0 },
]);
const stages = computed(() => overview.value?.stages ?? []);

// Personal reminders — static, no backend. Edit this list directly.
const reminders = [
  'resolva lang over prompts',
  'add a manual round for input extra info manually',
];
</script>

<template>
  <div>
    <div class="mb-4">
      <div class="kicker">// dashboard</div>
      <h1 class="m-0 text-2xl font-bold tracking-tight text-white">Dashboard</h1>
      <p class="mt-1 text-sm text-neutral-500">
        Across all tenant accounts — excludes the platform account.
      </p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div
        v-for="c in cards"
        :key="c.label"
        class="rounded-xl border border-neutral-800 bg-neutral-900 p-5"
      >
        <div class="font-mono text-3xl font-bold text-brand">{{ c.value }}</div>
        <div class="mt-1 text-xs uppercase tracking-wider text-neutral-500">{{ c.label }}</div>
      </div>
    </div>

    <div class="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div class="mb-4 font-mono text-xs uppercase tracking-wider text-neutral-500">
        // projects by stage
      </div>
      <p v-if="!overview?.projectCount" class="m-0 text-sm text-neutral-500">
        No projects across tenant accounts yet.
      </p>
      <div v-else class="flex flex-col gap-3">
        <div v-for="s in stages" :key="s.stage" class="flex items-center gap-3">
          <span class="w-40 shrink-0 font-mono text-xs text-neutral-300">{{ s.stage }}</span>
          <div class="h-2 flex-1 overflow-hidden rounded bg-neutral-800">
            <div class="h-full rounded bg-brand" :style="{ width: `${s.pct}%` }" />
          </div>
          <span class="w-24 shrink-0 text-right text-xs text-neutral-400">
            {{ s.pct }}% ({{ s.count }})
          </span>
        </div>
      </div>
    </div>

    <!-- Static reminders (no backend) -->
    <div class="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div class="mb-4 font-mono text-xs uppercase tracking-wider text-neutral-500">
        // reminders
      </div>
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        <li v-for="(r, i) in reminders" :key="i" class="flex items-start gap-2.5 text-sm text-neutral-300">
          <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          {{ r }}
        </li>
      </ul>
    </div>
  </div>
</template>
