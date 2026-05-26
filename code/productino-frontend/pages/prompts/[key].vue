<script setup lang="ts">
interface Stats {
  runs: number;
  successRate: number | null;
  avgScore: number | null;
  avgLatencyMs: number | null;
  avgTokensIn: number | null;
  avgTokensOut: number | null;
}
interface Version {
  id: number;
  version: number;
  isActive: boolean;
  source: string;
  model: string | null;
  notes: string | null;
  createdAt: string;
  stats: Stats;
}
interface Run {
  id: number;
  versionId: number;
  success: boolean | null;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  score: number | null;
  subjectType: string | null;
  subjectId: number | null;
  createdAt: string;
}
interface Detail {
  id: number;
  key: string;
  description: string | null;
  activeVersion: number | null;
  versions: Version[];
  recentRuns: Run[];
}

const route = useRoute();
const key = route.params.key as string;

const { data: prompt, error } = await useAsyncData<Detail | null>(`prompt-${key}`, () =>
  useApi<Detail>(`/prompts/${key}`).catch(() => null),
);

const fmtDate = (d: string) => new Date(d).toLocaleString();
const dash = (v: number | null, suffix = '') => (v == null ? '—' : `${v}${suffix}`);
function versionNo(versionId: number): string {
  const v = prompt.value?.versions.find((x) => x.id === versionId);
  return v ? `v${v.version}` : `#${versionId}`;
}
</script>

<template>
  <section v-if="prompt">
    <NuxtLink to="/prompts" class="text-sm text-neutral-500 hover:text-neutral-300">← Prompts</NuxtLink>
    <div class="kicker mt-2">// prompts / {{ prompt.key }}</div>
    <h1 class="m-0 text-2xl font-bold tracking-tight text-white">{{ prompt.key }}</h1>
    <p class="mb-6 mt-1 text-sm text-neutral-400">{{ prompt.description ?? '—' }}</p>

    <!-- Versions -->
    <h2 class="mb-2 text-sm font-semibold text-neutral-200">Versions</h2>
    <div class="mb-8 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <table class="w-full border-collapse">
        <thead>
          <tr class="font-mono text-[11px] uppercase tracking-wide text-neutral-500">
            <th class="border-b border-neutral-800 px-4 py-2.5 text-left">Version</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-left">Model</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-right">Runs</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-right">Success</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-right">Avg score</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-right">Avg latency</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-right">Avg tokens</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in prompt.versions" :key="v.id" class="text-sm text-neutral-300">
            <td class="border-b border-neutral-800/70 px-4 py-2.5">
              <span class="font-mono">v{{ v.version }}</span>
              <span v-if="v.isActive" class="ml-2 rounded border border-brand/40 px-1.5 py-0.5 font-mono text-[10px] text-brand">active</span>
            </td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 font-mono text-xs">{{ v.model ?? '—' }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-right">{{ v.stats.runs }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-right">{{ dash(v.stats.successRate, '%') }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-right">{{ dash(v.stats.avgScore) }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-right">{{ dash(v.stats.avgLatencyMs, 'ms') }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-right">
              {{ dash(v.stats.avgTokensIn) }} / {{ dash(v.stats.avgTokensOut) }}
            </td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-xs text-neutral-500">{{ fmtDate(v.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Recent runs -->
    <h2 class="mb-2 text-sm font-semibold text-neutral-200">Recent runs</h2>
    <div class="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <table class="w-full border-collapse">
        <thead>
          <tr class="font-mono text-[11px] uppercase tracking-wide text-neutral-500">
            <th class="border-b border-neutral-800 px-4 py-2.5 text-left">When</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-left">Version</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-center">OK</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-right">Score</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-right">Latency</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-right">Tokens</th>
            <th class="border-b border-neutral-800 px-4 py-2.5 text-left">Subject</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!prompt.recentRuns.length">
            <td colspan="7" class="py-6 text-center text-neutral-500">
              No runs recorded yet — they appear once an AI feature calls this prompt.
            </td>
          </tr>
          <tr v-for="r in prompt.recentRuns" :key="r.id" class="text-sm text-neutral-300">
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-xs text-neutral-500">{{ fmtDate(r.createdAt) }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 font-mono text-xs">{{ versionNo(r.versionId) }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-center">
              <span v-if="r.success === true" class="text-brand">✓</span>
              <span v-else-if="r.success === false" class="text-red-400">✗</span>
              <span v-else class="text-neutral-600">—</span>
            </td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-right">{{ dash(r.score) }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-right">{{ dash(r.latencyMs, 'ms') }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-right">{{ dash(r.tokensIn) }} / {{ dash(r.tokensOut) }}</td>
            <td class="border-b border-neutral-800/70 px-4 py-2.5 text-xs text-neutral-500">
              {{ r.subjectType ? `${r.subjectType}#${r.subjectId}` : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section v-else>
    <NuxtLink to="/prompts" class="text-sm text-neutral-500 hover:text-neutral-300">← Prompts</NuxtLink>
    <p class="mt-4 text-sm text-neutral-500">
      {{ error ? 'Could not load this prompt (requires MANAGE_PROMPTS).' : 'Prompt not found.' }}
    </p>
  </section>
</template>
