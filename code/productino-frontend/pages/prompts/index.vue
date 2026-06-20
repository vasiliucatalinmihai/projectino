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
    <h1 class="m-0 mb-1 break-words text-2xl font-bold tracking-tight text-white">Prompts</h1>
    <p class="mb-4 text-sm text-neutral-400">
      Versioned from <code class="text-brand">src/prompts/*.md</code>. Click a prompt to see its
      versions and run outcomes.
    </p>

    <p v-if="error" class="text-sm text-neutral-500">
      You need the MANAGE_PROMPTS permission to view prompts.
    </p>

    <div v-else class="hidden overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900 sm:block">
      <table class="w-full min-w-max border-collapse">
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

    <div v-if="!error" class="grid gap-3 sm:hidden">
      <div
        v-if="!prompts?.length"
        class="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-500"
      >
        No prompts yet.
      </div>
      <article
        v-for="p in prompts"
        :key="p.id"
        class="cursor-pointer rounded-xl border border-neutral-800 bg-neutral-900 p-4 active:border-brand/50"
        @click="navigateTo(`/prompts/${p.key}`)"
      >
        <div class="min-w-0 font-mono text-sm text-brand">{{ p.key }}</div>
        <p class="mb-4 mt-1 break-words text-sm text-neutral-300">{{ p.description ?? '—' }}</p>
        <dl class="m-0 grid grid-cols-3 gap-3 border-t border-neutral-800 pt-3">
          <div>
            <dt class="font-mono text-[10px] uppercase tracking-wide text-neutral-500">Active</dt>
            <dd class="m-0 mt-0.5 font-mono text-sm text-neutral-200">v{{ p.activeVersion ?? '—' }}</dd>
          </div>
          <div>
            <dt class="font-mono text-[10px] uppercase tracking-wide text-neutral-500">Versions</dt>
            <dd class="m-0 mt-0.5 font-mono text-sm text-neutral-200">{{ p.versionCount }}</dd>
          </div>
          <div>
            <dt class="font-mono text-[10px] uppercase tracking-wide text-neutral-500">Runs</dt>
            <dd class="m-0 mt-0.5 font-mono text-sm text-neutral-200">{{ p.runCount }}</dd>
          </div>
        </dl>
      </article>
    </div>
  </section>
</template>
