<script setup lang="ts">
interface PromptSummary {
  id: number;
  key: string;
  description: string | null;
  activeVersion: number | null;
  versionCount: number;
  runCount: number;
}

const { data: prompts, error } = await useAsyncData<PromptSummary[]>('prompts', () =>
  useApi<PromptSummary[]>('/prompts').catch(() => []),
);
</script>

<template>
  <section>
    <div class="kicker">// prompts</div>
    <h1 class="m-0 mb-1 text-2xl font-bold tracking-tight text-white">Prompts</h1>
    <p class="mb-4 text-sm text-neutral-400">
      Versioned from <code class="text-brand">src/prompts/*.md</code>. Click a prompt to see its
      versions and run outcomes.
    </p>

    <p v-if="error" class="text-sm text-neutral-500">
      You need the MANAGE_PROMPTS permission to view prompts.
    </p>

    <div v-else class="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <table class="w-full border-collapse">
        <thead>
          <tr>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-left font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-500">Key</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-left font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-500">Description</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-right font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-500">Active</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-right font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-500">Versions</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-right font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-500">Runs</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!prompts?.length">
            <td colspan="5" class="py-6 text-center text-neutral-500">No prompts yet.</td>
          </tr>
          <tr
            v-for="p in prompts"
            :key="p.id"
            class="cursor-pointer hover:bg-neutral-800/50"
            @click="navigateTo(`/prompts/${p.key}`)"
          >
            <td class="border-b border-neutral-800/70 px-4 py-2.5 font-mono text-sm text-brand">{{ p.key }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-sm text-neutral-300">{{ p.description ?? '—' }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-right text-sm text-neutral-300">v{{ p.activeVersion ?? '—' }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-right text-sm text-neutral-300">{{ p.versionCount }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-right text-sm text-neutral-300">{{ p.runCount }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
