<script setup lang="ts">
interface Project {
  id: number;
  name: string;
  accountId: number;
  clientId: number;
  clientName: string | null;
  briefing: string | null;
  stage: string;
}
interface ClientOption {
  id: number;
  name: string;
  accountId: number;
}

const route = useRoute();
const projectId = Number(route.params.id);

const { user } = useAuth();
// Account admins manage their own; super admins manage any account's projects.
const canManage = computed(
  () => !!user.value?.isSuperAdmin || (user.value?.permissions ?? []).includes('ADMIN'),
);

const STAGES = [
  'BRIEFING',
  'GAP_ANALYSIS',
  'AWAITING_CLIENT',
  'DEFINITION',
  'PLANNING',
  'DELIVERY',
];

const { data: project, error, refresh } = await useAsyncData<Project | null>(
  `project-${projectId}`,
  () => useApi<Project>(`/projects/${projectId}`).catch(() => null),
);

// Clients for the edit form. A project can't move across accounts, so offer
// only clients in this project's account.
const { data: allClients } = await useAsyncData<ClientOption[]>(`project-${projectId}-clients`, () =>
  canManage.value ? useApi<ClientOption[]>('/clients').catch(() => []) : Promise.resolve([]),
);
const accountClients = computed(() =>
  (allClients.value ?? []).filter((c) => c.accountId === project.value?.accountId),
);

const details = computed(() => [
  { label: 'ID', value: project.value?.id },
  { label: 'Client', value: project.value?.clientName },
  { label: 'Stage', value: project.value?.stage, mono: true },
  { label: 'Briefing', value: project.value?.briefing, pre: true },
]);

// --- edit ---
const showForm = ref(false);
const saving = ref(false);
const formError = ref('');
const form = reactive({ name: '', clientId: undefined as number | undefined, briefing: '', stage: '' });

function openEdit() {
  if (!project.value) return;
  Object.assign(form, {
    name: project.value.name,
    clientId: project.value.clientId,
    briefing: project.value.briefing ?? '',
    stage: project.value.stage,
  });
  formError.value = '';
  showForm.value = true;
}
async function save() {
  saving.value = true;
  formError.value = '';
  try {
    await useApi(`/projects/${projectId}`, {
      method: 'PATCH',
      body: {
        name: form.name,
        clientId: form.clientId,
        briefing: form.briefing || null,
        stage: form.stage,
      },
    });
    showForm.value = false;
    await refresh();
  } catch (e: any) {
    formError.value = e?.data?.message ?? 'Save failed';
  } finally {
    saving.value = false;
  }
}

const { confirm, alert } = useConfirm();
async function remove() {
  if (!project.value) return;
  if (!(await confirm({
    title: `Delete project "${project.value.name}"?`,
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    tone: 'danger',
  }))) return;
  try {
    await useApi(`/projects/${projectId}`, { method: 'DELETE' });
    await navigateTo('/projects');
  } catch (e: any) {
    await alert({ title: 'Delete failed', message: e?.data?.message, tone: 'danger' });
  }
}

// --- belief graph ---
interface Provenance {
  sourceId: number;
  span?: [number, number];
  quote?: string;
}
interface GraphSource {
  id: number;
  kind: string;
  label: string | null;
  content: string;
  round: number;
  createdAt: string;
}
interface CoverageArea {
  id: number;
  key: string;
  name: string;
  weight: string;
  rollupConfidence: number; // 0–1
  status: string;
  round: number;
}
interface BeliefNode {
  id: number;
  nodeType: string;
  kind: string;
  name: string;
  description: string | null;
  status: string;
  confidence: number; // 0–1
  coverageKey: string | null;
  provenance: Provenance[];
  round: number;
}
interface GraphQuestion {
  id: number;
  coverageKey: string | null;
  text: string;
  assumedAnswer: string | null;
  impact: string;
  status: string;
  answerText: string | null;
  round: number;
}
interface ProjectRound {
  index: number;
  rollupConfidence: number;
  createdAt: string;
}
interface BeliefGraph {
  projectId: number;
  rollupConfidence: number; // latest round rollup, 0–1
  sources: GraphSource[];
  coverageAreas: CoverageArea[];
  nodes: BeliefNode[];
  questions: GraphQuestion[];
  rounds: ProjectRound[];
}

const { data: graph } = await useAsyncData<BeliefGraph | null>(
  `project-${projectId}-graph`,
  () => useApi<BeliefGraph>(`/projects/${projectId}/graph`).catch(() => null),
);

// Confidence is stored 0–1; show it as a percentage.
const pct = (v: number) => Math.round((v ?? 0) * 100);

function coverageColor(v: number): string {
  const p = pct(v);
  if (p >= 70) return 'bg-green-500';
  if (p >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

const STATUS_CLASS: Record<string, string> = {
  STATED: 'border-green-500/40 text-green-300',
  CONFIRMED: 'border-green-500/40 text-green-300',
  INFERRED: 'border-amber-500/40 text-amber-300',
  ASSUMED: 'border-amber-500/40 text-amber-300',
  REJECTED: 'border-neutral-700 text-neutral-500',
  CONTRADICTED: 'border-red-500/40 text-red-300',
};
const IMPACT_CLASS: Record<string, string> = {
  HIGH: 'border-red-500/40 text-red-300',
  MEDIUM: 'border-amber-500/40 text-amber-300',
  LOW: 'border-neutral-600 text-neutral-400',
};

// Belief nodes grouped by their coverage area key (or "uncategorized").
const nodesByCoverage = computed(() => {
  const groups: Record<string, BeliefNode[]> = {};
  for (const n of graph.value?.nodes ?? []) {
    const k = n.coverageKey ?? 'uncategorized';
    (groups[k] ??= []).push(n);
  }
  return groups;
});

const sortedQuestions = computed(() => {
  const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return [...(graph.value?.questions ?? [])].sort(
    (a, b) => (order[a.impact] ?? 3) - (order[b.impact] ?? 3),
  );
});

// The Understanding layer is empty until the extraction/scoring pipeline runs.
const understandingEmpty = computed(
  () =>
    (graph.value?.coverageAreas.length ?? 0) === 0 &&
    (graph.value?.nodes.length ?? 0) === 0 &&
    (graph.value?.questions.length ?? 0) === 0,
);
</script>

<template>
  <div>
    <NuxtLink to="/projects" class="text-sm text-neutral-400 hover:text-brand">← Projects</NuxtLink>

    <p v-if="error || !project" class="mt-4 text-sm text-neutral-500">Project not found.</p>

    <template v-else>
      <div class="mb-5 mt-2 flex items-start justify-between">
        <div>
          <div class="kicker">// project</div>
          <h1 class="m-0 text-2xl font-bold tracking-tight text-white">{{ project.name }}</h1>
          <NuxtLink
            v-if="project.clientName"
            :to="`/clients/${project.clientId}`"
            class="text-sm text-neutral-400 hover:text-brand"
          >
            {{ project.clientName }} →
          </NuxtLink>
        </div>
        <div v-if="canManage" class="flex gap-2">
          <button class="btn-ghost text-red-400" @click="remove">Delete</button>
          <button class="btn-primary" @click="openEdit">Edit</button>
        </div>
      </div>

      <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <DetailList :items="details" />
      </div>

      <!-- Belief graph -->
      <div class="mt-8 flex flex-col gap-5">
        <div class="flex items-center justify-between">
          <div>
            <div class="kicker">// belief graph</div>
            <h2 class="m-0 text-xl font-bold tracking-tight text-white">Belief Graph</h2>
          </div>
          <div v-if="(graph?.rounds?.length ?? 0) > 0" class="flex items-end gap-2">
            <span class="font-mono text-3xl font-bold text-brand">{{ pct(graph?.rollupConfidence ?? 0) }}%</span>
            <span class="pb-1 text-xs uppercase tracking-wider text-neutral-500">confidence</span>
          </div>
        </div>

        <!-- sources (evidence layer) -->
        <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <div class="mb-4 font-mono text-xs uppercase tracking-wider text-neutral-500">// sources</div>
          <p v-if="!(graph?.sources?.length)" class="text-sm text-neutral-500">No sources yet.</p>
          <div v-else class="flex flex-col gap-3">
            <div v-for="s in graph?.sources ?? []" :key="s.id" class="border-l-2 border-neutral-800 pl-3">
              <div class="flex items-center gap-2">
                <span class="rounded border border-neutral-700 px-1.5 py-0.5 font-mono text-[10px] uppercase text-neutral-400">{{ s.kind }}</span>
                <span class="font-mono text-[10px] uppercase tracking-wider text-neutral-500">round {{ s.round }}</span>
              </div>
              <p class="mt-1 whitespace-pre-wrap text-sm text-neutral-300">{{ s.content }}</p>
            </div>
          </div>
        </div>

        <!-- understanding layer (empty until the pipeline runs) -->
        <div
          v-if="understandingEmpty"
          class="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 p-5 text-sm text-neutral-500"
        >
          The Understanding layer — coverage scores, belief nodes and clarifying questions — is
          empty. Extraction and scoring populate it in the next phases of the pipeline.
        </div>

        <template v-else>
          <!-- coverage areas -->
          <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <div class="mb-4 font-mono text-xs uppercase tracking-wider text-neutral-500">// coverage</div>
            <div class="flex flex-col gap-4">
              <div v-for="c in graph?.coverageAreas ?? []" :key="c.id">
                <div class="flex items-center gap-3">
                  <span class="w-44 shrink-0 font-mono text-xs text-neutral-300">{{ c.name }}</span>
                  <div class="h-2 flex-1 overflow-hidden rounded bg-neutral-800">
                    <div class="h-full rounded" :class="coverageColor(c.rollupConfidence)" :style="{ width: `${pct(c.rollupConfidence)}%` }" />
                  </div>
                  <span class="w-10 shrink-0 text-right text-xs text-neutral-400">{{ pct(c.rollupConfidence) }}%</span>
                </div>
                <div class="mt-1 flex gap-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  <span>{{ c.status }}</span><span>· weight {{ c.weight }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- belief nodes -->
          <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <div class="mb-4 font-mono text-xs uppercase tracking-wider text-neutral-500">// beliefs</div>
            <div class="flex flex-col gap-5">
              <div v-for="(nodes, key) in nodesByCoverage" :key="key">
                <div class="mb-2 font-mono text-[10px] uppercase tracking-wider text-neutral-600">{{ key }}</div>
                <div class="flex flex-col gap-3">
                  <div v-for="n in nodes" :key="n.id" class="border-l-2 border-neutral-800 pl-3">
                    <div class="flex flex-wrap items-center gap-2">
                      <span
                        class="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase"
                        :class="STATUS_CLASS[n.status] ?? 'border-neutral-600 text-neutral-400'"
                      >
                        {{ n.status }}
                      </span>
                      <span class="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{{ n.kind }}</span>
                      <span class="text-xs text-neutral-400">· {{ pct(n.confidence) }}%</span>
                      <span v-if="n.provenance?.length" class="font-mono text-[10px] text-neutral-600">{{ n.provenance.length }} src</span>
                    </div>
                    <p class="mt-1 text-sm text-neutral-200">{{ n.name }}</p>
                    <p v-if="n.description" class="mt-0.5 text-xs text-neutral-500">{{ n.description }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- clarifying questions -->
          <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <div class="mb-4 font-mono text-xs uppercase tracking-wider text-neutral-500">// clarifying questions</div>
            <div class="flex flex-col gap-4">
              <div v-for="q in sortedQuestions" :key="q.id" class="border-l-2 border-neutral-800 pl-3">
                <div class="flex items-center gap-2">
                  <span
                    class="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase"
                    :class="IMPACT_CLASS[q.impact] ?? IMPACT_CLASS.LOW"
                  >
                    {{ q.impact }}
                  </span>
                  <span v-if="q.coverageKey" class="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{{ q.coverageKey }}</span>
                  <span class="font-mono text-[10px] uppercase tracking-wider text-neutral-600">{{ q.status }}</span>
                </div>
                <p class="mt-1 text-sm text-neutral-200">{{ q.text }}</p>
                <p v-if="q.assumedAnswer" class="mt-1 text-xs text-neutral-500">
                  <span class="text-neutral-400">Assumed:</span> {{ q.assumedAnswer }}
                </p>
                <p v-if="q.answerText" class="mt-1 text-xs text-green-300/80">
                  <span class="text-neutral-400">Answer:</span> {{ q.answerText }}
                </p>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>

    <Modal v-if="showForm" title="Edit project" @close="showForm = false">
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <label class="field">Name<input v-model="form.name" class="inp" required /></label>
        <label class="field">
          Client
          <select v-model="form.clientId" class="inp" required>
            <option v-for="c in accountClients" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label class="field">
          Stage
          <select v-model="form.stage" class="inp">
            <option v-for="s in STAGES" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <label class="field">Briefing<textarea v-model="form.briefing" rows="4" class="inp" /></label>
        <p v-if="formError" class="m-0 text-sm text-red-400">{{ formError }}</p>
        <div class="mt-1 flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showForm = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>
