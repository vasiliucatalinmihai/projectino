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

interface PromptUsage {
  promptKey: string;
  runs: number;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
}
interface ProjectUsage {
  runs: number;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  byPrompt: PromptUsage[];
}
const { data: usage, refresh: refreshUsage } = await useAsyncData<ProjectUsage | null>(
  `project-${projectId}-usage`,
  () => useApi<ProjectUsage>(`/projects/${projectId}/usage`).catch(() => null),
);
const formatInt = (n: number) => (n ?? 0).toLocaleString('en-US');
const usageByPrompt = computed(() =>
  [...(usage.value?.byPrompt ?? [])].sort((a, b) => b.totalTokens - a.totalTokens),
);

const details = computed(() => [
  { label: 'ID', value: project.value?.id },
  { label: 'Client', value: project.value?.clientName },
  { label: 'Stage', value: project.value?.stage, mono: true },
]);

// Each main section collapses independently (header toggles; body in v-show).
const beliefOpen = ref(false);
const definitionOpen = ref(false);
const deliveryOpen = ref(false);
const proposalOpen = ref(false);

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
interface Conflict {
  id: number;
  summary: string;
  detail: string;
  beliefA: string;
  beliefB: string;
  status: string;
  round: number;
}
interface BeliefGraph {
  projectId: number;
  rollupConfidence: number; // latest round rollup, 0–1
  sources: GraphSource[];
  coverageAreas: CoverageArea[];
  nodes: BeliefNode[];
  questions: GraphQuestion[];
  rounds: ProjectRound[];
  conflicts: Conflict[];
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
const NODETYPE_CLASS: Record<string, string> = {
  REQUIREMENT: 'border-neutral-600 text-neutral-400',
  ASSUMPTION: 'border-amber-500/40 text-amber-300',
  RISK: 'border-red-500/40 text-red-300',
  DECISION: 'border-sky-500/40 text-sky-300',
};

// Provenance entries that carry a quote (the "why we believe this" evidence).
function provQuotes(n: BeliefNode): Provenance[] {
  return (n.provenance ?? []).filter((p) => !!p.quote);
}

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
  const answered = (q: GraphQuestion) => (q.status === 'ANSWERED' ? 1 : 0);
  return [...(graph.value?.questions ?? [])].sort(
    (a, b) => answered(a) - answered(b) || (order[a.impact] ?? 3) - (order[b.impact] ?? 3),
  );
});

// The Understanding layer is empty until the extraction/scoring pipeline runs.
const understandingEmpty = computed(
  () =>
    (graph.value?.coverageAreas.length ?? 0) === 0 &&
    (graph.value?.nodes.length ?? 0) === 0 &&
    (graph.value?.questions.length ?? 0) === 0,
);

const canRun = computed(() => {
  const perms = user.value?.permissions ?? [];
  return !!user.value?.isSuperAdmin || perms.includes('ADMIN') || perms.includes('RUN_LLM');
});
const canReset = computed(() => {
  const perms = user.value?.permissions ?? [];
  return !!user.value?.isSuperAdmin || perms.includes('ADMIN') || perms.includes('RESET_PROJECT');
});

// Re-running a step cascades a server-side reset of everything downstream, so
// refetch the derived artifacts to keep the UI in sync.
async function refreshDownstream() {
  await Promise.all([refreshDef(), refreshDelivery(), refreshProposal()]);
}

const RESET_LABELS: Record<string, string> = {
  graph: 'the entire Belief Graph and everything built from it (PRD, plan, proposal)',
  definition: 'the PRD, delivery plan and proposal',
  delivery: 'the delivery plan and proposal',
  proposal: 'the proposal',
};
async function resetPipeline(from: 'graph' | 'definition' | 'delivery' | 'proposal') {
  const ok = await confirm({
    title: 'Reset this step?',
    message: `This permanently clears ${RESET_LABELS[from]}. Sources (briefing & client answers) are kept. Continue?`,
    confirmLabel: 'Reset',
    tone: 'danger',
  });
  if (!ok) return;
  extractError.value = '';
  try {
    graph.value = await useApi<BeliefGraph>(`/projects/${projectId}/reset`, {
      method: 'POST',
      body: { from },
    });
    await Promise.all([refresh(), refreshDownstream()]);
  } catch (e: any) {
    extractError.value = e?.data?.message ?? 'Reset failed';
  }
}

const extracting = ref(false);
const extractError = ref('');
async function extract() {
  extracting.value = true;
  extractError.value = '';
  try {
    // The endpoint returns the refreshed graph, so swap it in directly.
    graph.value = await useApi<BeliefGraph>(`/projects/${projectId}/extract`, {
      method: 'POST',
      body: {},
    });
    await Promise.all([refresh(), refreshDownstream()]); // stage advanced; downstream cleared
  } catch (e: any) {
    extractError.value = e?.data?.message ?? 'Extraction failed';
  } finally {
    extracting.value = false;
  }
}

const scoring = ref(false);
async function score() {
  scoring.value = true;
  extractError.value = '';
  try {
    graph.value = await useApi<BeliefGraph>(`/projects/${projectId}/score`, {
      method: 'POST',
      body: {},
    });
    await Promise.all([refresh(), refreshDownstream()]); // re-score clears the PRD chain
  } catch (e: any) {
    extractError.value = e?.data?.message ?? 'Scoring failed';
  } finally {
    scoring.value = false;
  }
}

// Convergence delta across rounds, e.g. "13% → 55%".
const roundsDelta = computed(() =>
  (graph.value?.rounds ?? []).map((r) => `${pct(r.rollupConfidence)}%`).join(' → '),
);

// --- conflicts ---
const detectingConflicts = ref(false);
async function detectConflicts() {
  detectingConflicts.value = true;
  extractError.value = '';
  try {
    graph.value = await useApi<BeliefGraph>(`/projects/${projectId}/conflicts`, {
      method: 'POST',
      body: {},
    });
  } catch (e: any) {
    extractError.value = e?.data?.message ?? 'Conflict detection failed';
  } finally {
    detectingConflicts.value = false;
  }
}
async function resolveConflict(id: number, status: string) {
  extractError.value = '';
  try {
    graph.value = await useApi<BeliefGraph>(`/projects/${projectId}/conflicts/${id}`, {
      method: 'PATCH',
      body: { status },
    });
  } catch (e: any) {
    extractError.value = e?.data?.message ?? 'Update failed';
  }
}
const openConflicts = computed(
  () => (graph.value?.conflicts ?? []).filter((c) => c.status === 'OPEN').length,
);

// --- question curation ---
async function curate(questionId: number, patch: Record<string, any>) {
  extractError.value = '';
  try {
    await useApi(`/projects/${projectId}/questions/${questionId}`, { method: 'PATCH', body: patch });
    graph.value = await useApi<BeliefGraph>(`/projects/${projectId}/graph`);
  } catch (e: any) {
    extractError.value = e?.data?.message ?? 'Update failed';
  }
}

// --- client answers (the convergence loop) ---
const answersText = ref('');
const ingesting = ref(false);
async function ingestAnswers() {
  if (!answersText.value.trim()) return;
  ingesting.value = true;
  extractError.value = '';
  try {
    graph.value = await useApi<BeliefGraph>(`/projects/${projectId}/answers`, {
      method: 'POST',
      body: { answers: answersText.value },
    });
    answersText.value = '';
    await Promise.all([refresh(), refreshDownstream()]); // new answers clear downstream
  } catch (e: any) {
    extractError.value = e?.data?.message ?? 'Ingesting answers failed';
  } finally {
    ingesting.value = false;
  }
}

// --- client-facing questions export ---
const showDoc = ref(false);
const docText = ref('');
const docTitle = ref('Document');
async function exportDoc() {
  extractError.value = '';
  try {
    const res = await useApi<{ markdown: string }>(`/projects/${projectId}/questions/doc`);
    docText.value = res.markdown;
    docTitle.value = 'Client questions';
    showDoc.value = true;
  } catch (e: any) {
    extractError.value = e?.data?.message ?? 'Export failed';
  }
}
const copied = ref(false);
async function copyDoc() {
  const text = docText.value;
  let ok = false;
  // navigator.clipboard only exists in secure contexts (HTTPS/localhost); the
  // app runs on plain http://dev.production.io, so fall back to execCommand.
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      ok = false;
    }
  }
  if (ok) {
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  }
}

// --- product definition (PRD) ---
interface UserStory {
  role?: string;
  story: string;
  acceptance_criteria?: string[];
}
interface Risk {
  description: string;
  severity?: string;
  mitigation?: string;
}
interface DefinitionContent {
  summary?: string;
  in_scope?: string[];
  out_of_scope?: string[];
  user_stories?: UserStory[];
  non_functional?: string[];
  assumptions?: string[];
  risks?: Risk[];
}
interface ProductDefinition {
  id: number;
  version: number;
  confidenceAtGeneration: number;
  gateOverride: boolean;
  overrideReason: string | null;
  content: DefinitionContent;
  createdAt: string;
}

const { data: definition, refresh: refreshDef } = await useAsyncData<ProductDefinition | null>(
  `project-${projectId}-def`,
  () => useApi<ProductDefinition>(`/projects/${projectId}/definition`).catch(() => null),
);

// Coerce a PRD field to a string[] — the model sometimes returns a single
// string (or comma/newline-joined text) where an array is expected; rendering
// a string with v-for would otherwise iterate it character-by-character.
function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : String(x))).filter(Boolean);
  if (typeof v === 'string' && v.trim()) {
    const parts = v
      .split(/\n+|[;•]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length > 1 ? parts : [v.trim()];
  }
  return [];
}

const generating = ref(false);
async function postDefinition(override: boolean) {
  await useApi(`/projects/${projectId}/definition`, {
    method: 'POST',
    body: override ? { override: true, overrideReason: 'Manual override from UI' } : {},
  });
  // A new PRD clears the delivery plan + proposal downstream.
  await Promise.all([refreshDef(), refreshDelivery(), refreshProposal(), refresh()]);
}
async function generateDefinition() {
  generating.value = true;
  extractError.value = '';
  try {
    await postDefinition(false);
  } catch (e: any) {
    const data = e?.data;
    if (data?.gate) {
      const ok = await confirm({
        title: 'Below the confidence gate',
        message: `Overall confidence is ${Math.round((data.rollupConfidence ?? 0) * 100)}%, below the ${Math.round((data.threshold ?? 0.7) * 100)}% gate. Generate the PRD anyway?`,
        confirmLabel: 'Generate anyway',
      });
      if (ok) {
        try {
          await postDefinition(true);
        } catch (e2: any) {
          extractError.value = e2?.data?.message ?? 'Generation failed';
        }
      }
    } else {
      extractError.value = data?.message ?? 'Generation failed';
    }
  } finally {
    generating.value = false;
  }
}

// --- delivery plan ---
interface DeliveryNode {
  id: number;
  level: string;
  title: string;
  description: string | null;
  phase: string | null;
  estimateLow: number | null;
  estimateHigh: number | null;
  totalLow: number;
  totalHigh: number;
  children: DeliveryNode[];
}
interface DeliveryTree {
  epics: DeliveryNode[];
  totalLow: number;
  totalHigh: number;
}

const { data: delivery, refresh: refreshDelivery } = await useAsyncData<DeliveryTree | null>(
  `project-${projectId}-delivery`,
  () => useApi<DeliveryTree>(`/projects/${projectId}/delivery`).catch(() => null),
);
const planning = ref(false);
async function generateDelivery() {
  planning.value = true;
  extractError.value = '';
  try {
    delivery.value = await useApi<DeliveryTree>(`/projects/${projectId}/delivery`, {
      method: 'POST',
      body: {},
    });
    // A regenerated plan clears the proposal downstream.
    await Promise.all([refreshDelivery(), refreshProposal(), refresh()]);
  } catch (e: any) {
    extractError.value = e?.data?.message ?? 'Planning failed';
  } finally {
    planning.value = false;
  }
}
const PHASE_CLASS: Record<string, string> = {
  MVP: 'border-green-500/40 text-green-300',
  'Phase 2': 'border-sky-500/40 text-sky-300',
  Later: 'border-neutral-600 text-neutral-400',
};
function estLabel(lo: number | null, hi: number | null): string {
  if (lo == null && hi == null) return '';
  if (lo === hi) return `${lo}d`;
  return `${lo ?? 0}–${hi ?? 0}d`;
}

// --- proposal / SOW ---
interface ProposalPhase {
  name: string;
  narrative?: string;
  scope: string[];
  lowDays: number;
  highDays: number;
  lowCost: number;
  highCost: number;
}
interface ProposalContent {
  intro?: string;
  closing?: string;
  currency: string;
  dayRate: number;
  bufferPct: number;
  phases: ProposalPhase[];
  assumptions: string[];
  outOfScope: string[];
  totalLowDays: number;
  totalHighDays: number;
  totalLowCost: number;
  totalHighCost: number;
}
interface Proposal {
  id: number;
  version: number;
  currency: string;
  dayRate: number;
  totalLowCost: number;
  totalHighCost: number;
  content: ProposalContent;
  createdAt: string;
}

const { data: proposal, refresh: refreshProposal } = await useAsyncData<Proposal | null>(
  `project-${projectId}-proposal`,
  () => useApi<Proposal>(`/projects/${projectId}/proposal`).catch(() => null),
);
const proposing = ref(false);
async function generateProposal() {
  proposing.value = true;
  extractError.value = '';
  try {
    await useApi(`/projects/${projectId}/proposal`, { method: 'POST', body: {} });
    await refreshProposal();
  } catch (e: any) {
    extractError.value = e?.data?.message ?? 'Proposal generation failed';
  } finally {
    proposing.value = false;
  }
}
async function exportProposal() {
  extractError.value = '';
  try {
    const res = await useApi<{ markdown: string }>(`/projects/${projectId}/proposal/doc`);
    docText.value = res.markdown;
    docTitle.value = 'Proposal';
    showDoc.value = true;
  } catch (e: any) {
    extractError.value = e?.data?.message ?? 'Export failed';
  }
}
function money(n: number, cur: string): string {
  return `${cur} ${(n ?? 0).toLocaleString('en-US')}`;
}
function daysRange(lo: number, hi: number): string {
  return lo === hi ? `${lo}d` : `${lo}–${hi}d`;
}

// Refresh token usage whenever an LLM step changes the graph, PRD, plan or proposal.
watch([graph, definition, delivery, proposal], () => {
  refreshUsage();
});
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

      <!-- token usage -->
      <Collapsible
        v-if="usage && usage.runs"
        title="// token usage"
        :count="`${formatInt(usage.totalTokens)} tokens`"
        class="mt-4"
      >
        <p class="mb-3 text-sm text-neutral-300">
          <span class="font-mono font-bold text-brand">{{ formatInt(usage.totalTokens) }}</span> tokens
          <span class="text-neutral-500">({{ formatInt(usage.tokensIn) }} in · {{ formatInt(usage.tokensOut) }} out) over {{ usage.runs }} LLM runs</span>
        </p>
        <div class="flex flex-col gap-1">
          <div
            v-for="p in usageByPrompt"
            :key="p.promptKey"
            class="flex items-center justify-between gap-3 text-xs"
          >
            <span class="font-mono text-neutral-400">{{ p.promptKey }}</span>
            <span class="text-neutral-500">{{ formatInt(p.totalTokens) }} · {{ p.runs }} runs</span>
          </div>
        </div>
      </Collapsible>

      <!-- Belief graph -->
      <div class="mt-8">
        <div class="flex cursor-pointer items-center justify-between gap-3" @click="beliefOpen = !beliefOpen">
          <div class="flex items-center gap-3">
            <span class="text-neutral-600 transition-transform duration-150" :class="beliefOpen ? 'rotate-90' : ''">▸</span>
            <div>
              <div class="kicker">// belief graph</div>
              <h2 class="m-0 text-xl font-bold tracking-tight text-white">Belief Graph</h2>
            </div>
          </div>
          <div class="flex items-center gap-4" @click.stop>
            <div v-if="(graph?.rounds?.length ?? 0) > 0" class="text-right">
              <div class="flex items-end justify-end gap-2">
                <span class="font-mono text-3xl font-bold text-brand">{{ pct(graph?.rollupConfidence ?? 0) }}%</span>
                <span class="pb-1 text-xs uppercase tracking-wider text-neutral-500">confidence</span>
              </div>
              <p v-if="(graph?.rounds?.length ?? 0) > 1" class="mt-0.5 font-mono text-[11px] text-neutral-500">{{ roundsDelta }}</p>
            </div>
            <button
              v-if="canRun"
              class="btn-ghost"
              :disabled="extracting || scoring || !project.briefing"
              :title="!project.briefing ? 'Add a briefing first' : ''"
              @click="extract"
            >
              {{ extracting ? 'Extracting…' : (graph?.nodes?.length ? 'Re-extract' : 'Extract beliefs') }}
            </button>
            <button
              v-if="canRun"
              class="btn-primary"
              :disabled="scoring || extracting || !(graph?.nodes?.length)"
              :title="!(graph?.nodes?.length) ? 'Extract beliefs first' : ''"
              @click="score"
            >
              {{ scoring ? 'Scoring…' : (graph?.rounds?.length ? 'Re-score' : 'Score coverage') }}
            </button>
            <button
              v-if="canReset && (graph?.nodes?.length || (graph?.rounds?.length ?? 0) > 0)"
              class="btn-ghost text-xs text-red-400"
              @click="resetPipeline('graph')"
            >
              Reset
            </button>
          </div>
        </div>

        <div v-show="beliefOpen" class="mt-5 flex flex-col gap-5">
          <p v-if="extractError" class="text-sm text-red-400">{{ extractError }}</p>

        <!-- sources (evidence layer) — one collapsible per round of input -->
        <p
          v-if="!(graph?.sources?.length)"
          class="rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-500"
        >
          No sources yet.
        </p>
        <Collapsible
          v-for="s in graph?.sources ?? []"
          :key="s.id"
          :title="`${s.kind} · round ${s.round}`"
          :open="false"
        >
          <p class="whitespace-pre-wrap text-sm text-neutral-300">{{ s.content }}</p>
        </Collapsible>

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
          <Collapsible title="// coverage" :open="false">
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
          </Collapsible>

          <!-- conflicts -->
          <Collapsible title="// conflicts" :count="graph?.conflicts?.length ?? 0">
            <template #actions>
              <button
                v-if="canRun"
                class="btn-ghost text-xs"
                :disabled="detectingConflicts"
                @click="detectConflicts"
              >
                {{ detectingConflicts ? 'Detecting…' : 'Detect conflicts' }}
              </button>
            </template>
            <p v-if="!(graph?.conflicts?.length)" class="text-sm text-neutral-500">
              No conflicts detected.
            </p>
            <div v-else class="flex flex-col gap-3">
              <div
                v-for="c in graph?.conflicts ?? []"
                :key="c.id"
                class="rounded-lg border p-3"
                :class="c.status === 'OPEN' ? 'border-red-500/30' : 'border-neutral-800 opacity-60'"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-semibold text-neutral-200">{{ c.summary }}</span>
                  <button
                    v-if="canRun"
                    class="font-mono text-[10px] uppercase tracking-wider text-neutral-500 hover:text-neutral-200"
                    @click="resolveConflict(c.id, c.status === 'OPEN' ? 'RESOLVED' : 'OPEN')"
                  >
                    {{ c.status === 'OPEN' ? 'resolve' : 'reopen' }}
                  </button>
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                  <span class="rounded border border-neutral-700 px-1.5 py-0.5">{{ c.beliefA }}</span>
                  <span class="text-neutral-600">⇄</span>
                  <span class="rounded border border-neutral-700 px-1.5 py-0.5">{{ c.beliefB }}</span>
                </div>
                <p class="mt-1 text-xs text-neutral-500">{{ c.detail }}</p>
              </div>
            </div>
          </Collapsible>

          <!-- belief nodes — one collapsible per rubric category -->
          <div class="kicker">// beliefs</div>
          <Collapsible
            v-for="(nodes, key) in nodesByCoverage"
            :key="key"
            :title="String(key)"
            :count="nodes.length"
            :open="false"
          >
            <div class="flex flex-col gap-3">
              <div v-for="n in nodes" :key="n.id" class="border-l-2 border-neutral-800 pl-3">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase"
                    :class="STATUS_CLASS[n.status] ?? 'border-neutral-600 text-neutral-400'"
                  >
                    {{ n.status }}
                  </span>
                  <span
                    class="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase"
                    :class="NODETYPE_CLASS[n.nodeType] ?? 'border-neutral-600 text-neutral-400'"
                  >
                    {{ n.nodeType }}
                  </span>
                  <span class="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{{ n.kind }}</span>
                  <span class="text-xs text-neutral-400">· {{ pct(n.confidence) }}%</span>
                </div>
                <p class="mt-1 text-sm text-neutral-200">{{ n.name }}</p>
                <p v-if="n.description" class="mt-0.5 text-xs text-neutral-500">{{ n.description }}</p>
                <!-- provenance: why we believe this -->
                <ul
                  v-if="provQuotes(n).length"
                  class="mt-1 flex list-none flex-col gap-0.5 border-l border-neutral-800 pl-2"
                >
                  <li v-for="(p, k) in provQuotes(n)" :key="k" class="text-[11px] italic text-neutral-600">
                    “{{ p.quote }}”
                  </li>
                </ul>
              </div>
            </div>
          </Collapsible>

          <!-- clarifying questions -->
          <Collapsible title="// clarifying questions" :open="false" :count="graph?.questions?.length ?? 0">
            <template #actions>
              <button v-if="graph?.questions?.length" class="btn-ghost text-xs" @click="exportDoc">
                Export for client
              </button>
            </template>
            <div class="flex flex-col gap-4">
              <div
                v-for="q in sortedQuestions"
                :key="q.id"
                class="border-l-2 pl-3"
                :class="q.status === 'EXCLUDED' ? 'border-neutral-800 opacity-50' : 'border-neutral-800'"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase"
                    :class="IMPACT_CLASS[q.impact] ?? IMPACT_CLASS.LOW"
                  >
                    {{ q.impact }}
                  </span>
                  <span v-if="q.coverageKey" class="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{{ q.coverageKey }}</span>
                  <span class="font-mono text-[10px] uppercase tracking-wider text-neutral-600">{{ q.status }}</span>
                  <!-- curation: include / exclude (hidden once answered) -->
                  <span v-if="canRun && q.status !== 'ANSWERED'" class="ml-auto flex gap-2">
                    <button
                      v-if="q.status !== 'INCLUDED'"
                      class="font-mono text-[10px] uppercase tracking-wider text-neutral-500 hover:text-green-300"
                      @click="curate(q.id, { status: 'INCLUDED' })"
                    >
                      include
                    </button>
                    <button
                      v-if="q.status !== 'EXCLUDED'"
                      class="font-mono text-[10px] uppercase tracking-wider text-neutral-500 hover:text-red-300"
                      @click="curate(q.id, { status: 'EXCLUDED' })"
                    >
                      exclude
                    </button>
                  </span>
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
          </Collapsible>

          <!-- client answers (the convergence loop) -->
          <div v-if="canRun" class="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <div class="mb-3 font-mono text-xs uppercase tracking-wider text-neutral-500">// client answers</div>
            <p class="mb-2 text-xs text-neutral-500">
              Paste the client's reply — it's mapped onto the open questions, folded in as a new
              round, and the graph re-converges.
            </p>
            <textarea
              v-model="answersText"
              rows="4"
              class="inp"
              placeholder="Paste the client's reply here…"
            />
            <div class="mt-2 flex justify-end">
              <button
                class="btn-primary"
                :disabled="ingesting || !answersText.trim()"
                @click="ingestAnswers"
              >
                {{ ingesting ? 'Ingesting…' : 'Submit client answers' }}
              </button>
            </div>
          </div>
        </template>
        </div>
      </div>

      <!-- product definition (PRD) -->
      <div class="mt-8">
        <div class="flex cursor-pointer items-center justify-between gap-3" @click="definitionOpen = !definitionOpen">
          <div class="flex items-center gap-3">
            <span class="text-neutral-600 transition-transform duration-150" :class="definitionOpen ? 'rotate-90' : ''">▸</span>
            <div>
              <div class="kicker">// product definition</div>
              <h2 class="m-0 text-xl font-bold tracking-tight text-white">Product Definition</h2>
            </div>
          </div>
          <div class="flex items-center gap-3" @click.stop>
            <button
              v-if="canRun"
              class="btn-primary"
              :disabled="generating || !(graph?.rounds?.length)"
              :title="!(graph?.rounds?.length) ? 'Score coverage first' : ''"
              @click="generateDefinition"
            >
              {{ generating ? 'Generating…' : definition ? 'Regenerate PRD' : 'Generate PRD' }}
            </button>
            <button
              v-if="canReset && definition"
              class="btn-ghost text-xs text-red-400"
              @click="resetPipeline('definition')"
            >
              Reset
            </button>
          </div>
        </div>

        <div v-show="definitionOpen" class="mt-5 flex flex-col gap-5">

        <div
          v-if="!definition"
          class="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 p-5 text-sm text-neutral-500"
        >
          No definition yet. Once confidence clears the gate (or you override), generate the PRD here.
        </div>

        <div v-else class="flex flex-col gap-5">
          <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-mono text-xs uppercase tracking-wider text-neutral-500">v{{ definition.version }}</span>
              <span class="text-xs text-neutral-500">generated at {{ pct(definition.confidenceAtGeneration) }}% confidence</span>
              <span
                v-if="definition.gateOverride"
                class="rounded border border-amber-500/40 px-1.5 py-0.5 font-mono text-[10px] uppercase text-amber-300"
              >
                gate overridden
              </span>
            </div>
            <p v-if="definition.gateOverride && definition.overrideReason" class="mt-1 text-xs text-amber-300/80">
              Override reason: {{ definition.overrideReason }}
            </p>
            <p class="mt-2 text-sm text-neutral-200">{{ definition.content.summary }}</p>
          </div>

          <Collapsible title="// in scope" :open="false" :count="asList(definition.content.in_scope).length">
            <ul class="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-300">
              <li v-for="(s, i) in asList(definition.content.in_scope)" :key="i">{{ s }}</li>
            </ul>
          </Collapsible>

          <Collapsible title="// out of scope" :open="false" :count="asList(definition.content.out_of_scope).length">
            <ul class="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-400">
              <li v-for="(s, i) in asList(definition.content.out_of_scope)" :key="i">{{ s }}</li>
            </ul>
          </Collapsible>

          <Collapsible title="// user stories" :open="false" :count="(definition.content.user_stories ?? []).length">
            <div class="flex flex-col gap-4">
              <div
                v-for="(u, i) in definition.content.user_stories ?? []"
                :key="i"
                class="border-l-2 border-neutral-800 pl-3"
              >
                <p class="text-sm text-neutral-200">
                  <span v-if="u.role" class="mr-2 rounded border border-neutral-700 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">{{ u.role }}</span>{{ u.story }}
                </p>
                <ul
                  v-if="asList(u.acceptance_criteria).length"
                  class="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-xs text-neutral-500"
                >
                  <li v-for="(a, j) in asList(u.acceptance_criteria)" :key="j">{{ a }}</li>
                </ul>
              </div>
            </div>
          </Collapsible>

          <Collapsible title="// non-functional" :open="false" :count="asList(definition.content.non_functional).length">
            <ul class="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-300">
              <li v-for="(s, i) in asList(definition.content.non_functional)" :key="i">{{ s }}</li>
            </ul>
          </Collapsible>

          <Collapsible title="// assumptions" :open="false" :count="asList(definition.content.assumptions).length">
            <ul class="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-400">
              <li v-for="(s, i) in asList(definition.content.assumptions)" :key="i">{{ s }}</li>
            </ul>
          </Collapsible>

          <Collapsible title="// risk register" :open="false" :count="(definition.content.risks ?? []).length">
            <div class="flex flex-col gap-3">
              <div
                v-for="(r, i) in definition.content.risks ?? []"
                :key="i"
                class="border-l-2 border-neutral-800 pl-3"
              >
                <span
                  class="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase"
                  :class="IMPACT_CLASS[(r.severity || '').toUpperCase()] ?? IMPACT_CLASS.LOW"
                >
                  {{ r.severity || 'risk' }}
                </span>
                <p class="mt-1 text-sm text-neutral-200">{{ r.description }}</p>
                <p v-if="r.mitigation" class="mt-1 text-xs text-neutral-500">
                  <span class="text-neutral-400">Mitigation:</span> {{ r.mitigation }}
                </p>
              </div>
            </div>
          </Collapsible>
        </div>
        </div>
      </div>

      <!-- delivery plan -->
      <div class="mt-8">
        <div class="flex cursor-pointer items-center justify-between gap-3" @click="deliveryOpen = !deliveryOpen">
          <div class="flex items-center gap-3">
            <span class="text-neutral-600 transition-transform duration-150" :class="deliveryOpen ? 'rotate-90' : ''">▸</span>
            <div>
              <div class="kicker">// delivery plan</div>
              <h2 class="m-0 text-xl font-bold tracking-tight text-white">Delivery Plan</h2>
            </div>
          </div>
          <div class="flex items-center gap-4" @click.stop>
            <div v-if="delivery?.epics?.length" class="text-right">
              <span class="font-mono text-3xl font-bold text-brand">{{ estLabel(delivery.totalLow, delivery.totalHigh) }}</span>
              <p class="mt-0.5 text-xs uppercase tracking-wider text-neutral-500">estimate</p>
            </div>
            <button
              v-if="canRun"
              class="btn-primary"
              :disabled="planning || !definition"
              :title="!definition ? 'Generate a PRD first' : ''"
              @click="generateDelivery"
            >
              {{ planning ? 'Planning…' : delivery?.epics?.length ? 'Regenerate plan' : 'Generate plan' }}
            </button>
            <button
              v-if="canReset && delivery?.epics?.length"
              class="btn-ghost text-xs text-red-400"
              @click="resetPipeline('delivery')"
            >
              Reset
            </button>
          </div>
        </div>

        <div v-show="deliveryOpen" class="mt-5 flex flex-col gap-5">

        <div
          v-if="!(delivery?.epics?.length)"
          class="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 p-5 text-sm text-neutral-500"
        >
          No delivery plan yet. Generate it from the PRD to get epics, stories and ranged task estimates.
        </div>

        <Collapsible
          v-for="epic in delivery?.epics ?? []"
          :key="epic.id"
          :title="epic.title"
          :count="estLabel(epic.totalLow, epic.totalHigh)"
        >
          <p v-if="epic.description" class="mb-3 text-xs text-neutral-500">{{ epic.description }}</p>
          <div class="flex flex-col gap-4">
            <div v-for="story in epic.children" :key="story.id" class="border-l-2 border-neutral-800 pl-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-semibold text-neutral-200">{{ story.title }}</span>
                <span class="shrink-0 font-mono text-[10px] text-neutral-500">{{ estLabel(story.totalLow, story.totalHigh) }}</span>
              </div>
              <div class="mt-2 flex flex-col gap-1.5">
                <div
                  v-for="task in story.children"
                  :key="task.id"
                  class="flex items-center justify-between gap-2 text-sm"
                >
                  <span class="flex items-center gap-2 text-neutral-300">
                    <span
                      v-if="task.phase"
                      class="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase"
                      :class="PHASE_CLASS[task.phase] ?? 'border-neutral-600 text-neutral-400'"
                    >
                      {{ task.phase }}
                    </span>
                    {{ task.title }}
                  </span>
                  <span class="shrink-0 font-mono text-xs text-neutral-400">{{ estLabel(task.estimateLow, task.estimateHigh) }}</span>
                </div>
              </div>
            </div>
          </div>
        </Collapsible>
      </div>
      </div>

      <!-- proposal / SOW -->
      <div class="mt-8">
        <div class="flex cursor-pointer items-center justify-between gap-3" @click="proposalOpen = !proposalOpen">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="text-neutral-600 transition-transform duration-150" :class="proposalOpen ? 'rotate-90' : ''">▸</span>
            <div>
              <div class="kicker">// proposal</div>
              <h2 class="m-0 text-xl font-bold tracking-tight text-white">Proposal</h2>
            </div>
            <span v-if="proposal" class="font-mono text-sm font-bold text-brand">
              {{ money(proposal.content.totalLowCost, proposal.content.currency) }}–{{ money(proposal.content.totalHighCost, proposal.content.currency) }}
            </span>
          </div>
          <div class="flex items-center gap-3" @click.stop>
            <button v-if="proposal" class="btn-ghost text-xs" @click="exportProposal">Export</button>
            <button
              v-if="canRun"
              class="btn-primary"
              :disabled="proposing || !(delivery?.epics?.length)"
              :title="!(delivery?.epics?.length) ? 'Generate a delivery plan first' : ''"
              @click="generateProposal"
            >
              {{ proposing ? 'Pricing…' : proposal ? 'Regenerate proposal' : 'Generate proposal' }}
            </button>
            <button
              v-if="canReset && proposal"
              class="btn-ghost text-xs text-red-400"
              @click="resetPipeline('proposal')"
            >
              Reset
            </button>
          </div>
        </div>

        <div v-show="proposalOpen" class="mt-5 flex flex-col gap-5">
          <div
            v-if="!proposal"
            class="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 p-5 text-sm text-neutral-500"
          >
            No proposal yet. Generate it from the delivery plan to get a priced, phased proposal.
          </div>

          <div v-else class="flex flex-col gap-5">
            <!-- investment headline -->
            <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span class="font-mono text-3xl font-bold text-brand">
                    {{ money(proposal.content.totalLowCost, proposal.content.currency) }}–{{ money(proposal.content.totalHighCost, proposal.content.currency) }}
                  </span>
                  <p class="mt-0.5 text-xs uppercase tracking-wider text-neutral-500">
                    {{ daysRange(proposal.content.totalLowDays, proposal.content.totalHighDays) }} ·
                    day rate {{ money(proposal.content.dayRate, proposal.content.currency) }} ·
                    {{ proposal.content.bufferPct }}% buffer
                  </p>
                </div>
                <span class="font-mono text-[10px] uppercase tracking-wider text-neutral-600">v{{ proposal.version }}</span>
              </div>
              <p v-if="proposal.content.intro" class="mt-3 text-sm text-neutral-200">{{ proposal.content.intro }}</p>
            </div>

          <!-- phases -->
          <Collapsible
            v-for="(ph, i) in proposal.content.phases"
            :key="i"
            :title="ph.name"
            :count="`${daysRange(ph.lowDays, ph.highDays)} · ${money(ph.lowCost, proposal.content.currency)}–${money(ph.highCost, proposal.content.currency)}`"
          >
            <p v-if="ph.narrative" class="mb-2 text-sm text-neutral-300">{{ ph.narrative }}</p>
            <ul class="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-400">
              <li v-for="(s, j) in ph.scope" :key="j">{{ s }}</li>
            </ul>
          </Collapsible>

          <Collapsible
            v-if="proposal.content.assumptions.length"
            title="// assumptions"
            :count="proposal.content.assumptions.length"
          >
            <ul class="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-400">
              <li v-for="(a, i) in proposal.content.assumptions" :key="i">{{ a }}</li>
            </ul>
          </Collapsible>

          <Collapsible
            v-if="proposal.content.outOfScope.length"
            title="// out of scope"
            :count="proposal.content.outOfScope.length"
          >
            <ul class="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-400">
              <li v-for="(o, i) in proposal.content.outOfScope" :key="i">{{ o }}</li>
            </ul>
          </Collapsible>

          <p v-if="proposal.content.closing" class="text-sm text-neutral-300">{{ proposal.content.closing }}</p>
          </div>
        </div>
      </div>
    </template>

    <Modal v-if="showForm" title="Edit project" size="3xl" @close="showForm = false">
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
        <label class="field">Briefing<textarea v-model="form.briefing" rows="14" class="inp font-mono text-sm" /></label>
        <p v-if="formError" class="m-0 text-sm text-red-400">{{ formError }}</p>
        <div class="mt-1 flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showForm = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </Modal>

    <Modal v-if="showDoc" :title="docTitle" @close="showDoc = false">
      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs text-neutral-500">
          Client-facing — internal scores are hidden. Copy this into your email or doc.
        </p>
        <pre class="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-200">{{ docText }}</pre>
        <div class="flex justify-end gap-2">
          <button class="btn-ghost" @click="showDoc = false">Close</button>
          <button class="btn-primary" @click="copyDoc">{{ copied ? 'Copied!' : 'Copy' }}</button>
        </div>
      </div>
    </Modal>
  </div>
</template>
