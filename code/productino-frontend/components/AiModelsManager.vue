<script setup lang="ts">
/**
 * AI model management for one account.
 *
 * - No `accountId` (self-service): hits `/ai-models` for the caller's own account.
 * - With `accountId` (super admin on the system-admin side): scopes every call
 *   to that account via `?accountId=` / the create body.
 */
const props = defineProps<{ accountId?: number }>();

interface AiModel {
  id: number;
  label: string | null;
  provider: string;
  model: string;
  baseUrl: string | null;
  options: Record<string, any>;
  isActive: boolean;
  hasKey: boolean;
  keyHint: string | null;
  runCount: number;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  lastUsedAt: string | null;
}
interface Effective {
  source: 'account' | 'system';
  provider: string | null;
  model: string | null;
  configured: boolean;
}

const { user } = useAuth();
const canManage = computed(
  () => !!user.value?.isSuperAdmin || (user.value?.permissions ?? []).includes('ADMIN'),
);

const scope = props.accountId != null ? `?accountId=${props.accountId}` : '';
const keyBase = `ai-models-${props.accountId ?? 'self'}`;

const { data: models, refresh } = await useAsyncData<AiModel[]>(keyBase, () =>
  useApi<AiModel[]>(`/ai-models${scope}`).catch(() => []),
);
const { data: effective, refresh: refreshEffective } = await useAsyncData<Effective | null>(
  `${keyBase}-effective`,
  () => useApi<Effective>(`/ai-models/effective${scope}`).catch(() => null),
);

// BYO state is implied by the resolved source: 'account' = own model, 'system' = default.
const byo = computed(() => effective.value?.source === 'account');

// Rolled-up usage across this account's models.
const totals = computed(() => {
  const ms = models.value ?? [];
  return {
    runs: ms.reduce((s, m) => s + (m.runCount ?? 0), 0),
    tokensIn: ms.reduce((s, m) => s + (m.tokensIn ?? 0), 0),
    tokensOut: ms.reduce((s, m) => s + (m.tokensOut ?? 0), 0),
    total: ms.reduce((s, m) => s + (m.totalTokens ?? 0), 0),
  };
});

const fmtInt = (n: number) => (n ?? 0).toLocaleString('en-US');

const columns = [
  { key: 'label', label: 'Label' },
  { key: 'provider', label: 'Provider' },
  { key: 'model', label: 'Model' },
  { key: 'keyHint', label: 'Key' },
  { key: 'runsLabel', label: 'Runs' },
  { key: 'tokensLabel', label: 'Tokens' },
  { key: 'activeLabel', label: 'Active' },
];
const rows = computed(() =>
  (models.value ?? []).map((m) => ({
    ...m,
    label: m.label ?? '—',
    keyHint: m.keyHint ?? 'no key',
    runsLabel: fmtInt(m.runCount),
    tokensLabel: m.totalTokens ? `${fmtInt(m.totalTokens)}` : '—',
    activeLabel: m.isActive ? '● active' : '',
  })),
);

// Provider → models catalog is server-driven (the system account's
// AI_MODEL_CATALOG setting), so it's editable at runtime without a deploy. The
// fallback keeps the form usable if the request fails. Pick "Custom…" for
// anything not listed (new releases, fine-tunes, an OpenAI-compatible model).
const FALLBACK_CATALOG: Record<string, string[]> = {
  anthropic: ['claude-opus-4-8', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3', 'o4-mini'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-72b-instruct'],
};
const CUSTOM = '__custom__';

const { data: catalog } = await useAsyncData<Record<string, string[]>>('ai-model-catalog', () =>
  useApi<{ catalog: Record<string, string[]> }>('/ai-models/catalog')
    .then((r) => r.catalog)
    .catch(() => FALLBACK_CATALOG),
);

const PROVIDERS = computed(() => {
  const keys = Object.keys(catalog.value ?? {});
  return keys.length ? keys : Object.keys(FALLBACK_CATALOG);
});

const showForm = ref(false);
const editing = ref<AiModel | null>(null);
const saving = ref(false);
const formError = ref('');
const form = reactive({
  label: '',
  provider: 'anthropic',
  model: '',
  apiKey: '',
  baseUrl: '',
  options: '',
});

// Model is chosen from the provider's list, or entered freely via "Custom…".
const modelSelect = ref<string>(CUSTOM);
const providerModels = computed(() => (catalog.value ?? FALLBACK_CATALOG)[form.provider] ?? []);
const customModel = computed(() => modelSelect.value === CUSTOM);

// Align the dropdown to form.model after opening the form or switching provider.
function syncModelSelect() {
  modelSelect.value =
    form.model && providerModels.value.includes(form.model)
      ? form.model
      : form.model
        ? CUSTOM
        : providerModels.value[0] ?? CUSTOM;
  if (modelSelect.value !== CUSTOM) form.model = modelSelect.value;
}
function onProviderChange() {
  // Default to the new provider's first model (or custom if it has none listed).
  form.model = providerModels.value[0] ?? '';
  modelSelect.value = form.model || CUSTOM;
}
function onModelSelectChange() {
  form.model = modelSelect.value === CUSTOM ? '' : modelSelect.value;
}

function openCreate() {
  editing.value = null;
  Object.assign(form, {
    label: '',
    provider: PROVIDERS.value[0] ?? 'anthropic',
    model: '',
    apiKey: '',
    baseUrl: '',
    options: '',
  });
  syncModelSelect();
  formError.value = '';
  showForm.value = true;
}
function openEdit(m: AiModel) {
  editing.value = m;
  Object.assign(form, {
    label: m.label ?? '',
    provider: m.provider,
    model: m.model,
    apiKey: '', // never prefilled; blank = keep existing
    baseUrl: m.baseUrl ?? '',
    options:
      m.options && Object.keys(m.options).length ? JSON.stringify(m.options, null, 2) : '',
  });
  syncModelSelect();
  formError.value = '';
  showForm.value = true;
}
async function save() {
  saving.value = true;
  formError.value = '';

  // Options is authored as JSON text; parse to an object (blank = clear to {}).
  let options: Record<string, any> = {};
  const rawOptions = form.options.trim();
  if (rawOptions) {
    try {
      const parsed = JSON.parse(rawOptions);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      options = parsed;
    } catch {
      formError.value = 'Options must be a valid JSON object.';
      saving.value = false;
      return;
    }
  }

  const body: Record<string, any> = {
    label: form.label || undefined,
    provider: form.provider,
    model: form.model,
    baseUrl: form.baseUrl || undefined,
    options,
  };
  if (form.apiKey) body.apiKey = form.apiKey;
  if (!editing.value && props.accountId != null) body.accountId = props.accountId;

  try {
    if (editing.value) await useApi(`/ai-models/${editing.value.id}`, { method: 'PATCH', body });
    else await useApi('/ai-models', { method: 'POST', body });
    showForm.value = false;
    await Promise.all([refresh(), refreshEffective()]);
  } catch (e: any) {
    formError.value = e?.data?.message ?? 'Save failed';
  } finally {
    saving.value = false;
  }
}
const { confirm, alert } = useConfirm();
async function onAction({ key, row }: { key: string; row: AiModel }) {
  if (key === 'activate') {
    try {
      await useApi(`/ai-models/${row.id}/activate`, { method: 'POST' });
      await Promise.all([refresh(), refreshEffective()]);
    } catch (e: any) {
      await alert({ title: 'Could not activate', message: e?.data?.message, tone: 'danger' });
    }
  } else if (key === 'test') {
    try {
      const res: any = await useApi(`/ai-models/${row.id}/test`, { method: 'POST' });
      if (res?.ok) {
        await alert({
          title: 'Connection OK',
          message: `${res.provider}/${res.model} responded in ${res.latencyMs ?? '?'} ms.`,
          tone: 'info',
        });
      } else {
        await alert({ title: 'Connection failed', message: res?.message ?? 'Unknown error', tone: 'danger' });
      }
    } catch (e: any) {
      await alert({ title: 'Test failed', message: e?.data?.message ?? 'Request failed', tone: 'danger' });
    }
  }
}
async function remove(m: AiModel) {
  if (!(await confirm({
    title: `Delete AI model "${m.label ?? m.model}"?`,
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    tone: 'danger',
  }))) return;
  try {
    await useApi(`/ai-models/${m.id}`, { method: 'DELETE' });
    await Promise.all([refresh(), refreshEffective()]);
  } catch (e: any) {
    await alert({ title: 'Delete failed', message: e?.data?.message, tone: 'danger' });
  }
}
</script>

<template>
  <div>
    <!-- Effective model + BYO status -->
    <div class="mb-5 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="font-mono text-xs uppercase tracking-wider text-neutral-500">// processing uses</span>
        <template v-if="effective?.configured">
          <span class="font-mono text-brand">{{ effective.provider }}/{{ effective.model }}</span>
          <span class="text-neutral-500">
            ({{ effective.source === 'account' ? 'account model' : 'platform default' }})
          </span>
        </template>
        <span v-else class="text-amber-300">
          {{ byo ? 'Bring-your-own AI is on, but no active model is configured.' : 'No platform default is configured.' }}
        </span>
      </div>
      <p class="mt-2 text-xs text-neutral-500">
        Bring your own AI:
        <span :class="byo ? 'text-brand' : 'text-neutral-400'">{{ byo ? 'ON' : 'OFF' }}</span>
        <template v-if="accountId != null"> — toggle it on the account's Edit form.</template>
        <template v-else> — set by a platform admin.</template>
        <template v-if="!byo"> While off, models are saved but the platform default is used.</template>
      </p>
    </div>

    <p v-if="totals.runs" class="mb-3 break-words text-xs text-neutral-500">
      <span class="font-mono uppercase tracking-wider">// usage</span>
      <span class="ml-1 font-mono font-bold text-brand">{{ fmtInt(totals.total) }}</span> tokens
      <span class="text-neutral-600">({{ fmtInt(totals.tokensIn) }} in · {{ fmtInt(totals.tokensOut) }} out)</span>
      across <span class="text-neutral-300">{{ fmtInt(totals.runs) }}</span> runs
    </p>

    <DataGrid
      :creatable="canManage"
      :editable="canManage"
      :deletable="canManage"
      :clickable="false"
      :columns="columns"
      :rows="rows"
      :extra-actions="
        canManage
          ? [
              { key: 'test', label: 'Test', variant: 'muted' },
              { key: 'activate', label: 'Set active', variant: 'brand' },
            ]
          : []
      "
      empty-text="No AI models yet."
      @create="openCreate"
      @edit="openEdit"
      @action="onAction"
      @remove="remove"
    />

    <Modal v-if="showForm" :title="editing ? 'Edit AI model' : 'Add AI model'" @close="showForm = false">
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <label class="field">Label<input v-model="form.label" class="inp" placeholder="optional" /></label>
        <label class="field">
          Provider
          <select v-model="form.provider" class="inp" @change="onProviderChange">
            <option v-for="p in PROVIDERS" :key="p" :value="p">{{ p }}</option>
          </select>
        </label>
        <label class="field">
          Model
          <select v-model="modelSelect" class="inp" @change="onModelSelectChange">
            <option v-for="m in providerModels" :key="m" :value="m">{{ m }}</option>
            <option :value="CUSTOM">Custom…</option>
          </select>
        </label>
        <label v-if="customModel" class="field">
          Custom model ID
          <input v-model="form.model" class="inp" placeholder="provider-specific model id" required />
        </label>
        <label class="field">
          API key
          <input
            v-model="form.apiKey"
            type="password"
            class="inp"
            autocomplete="off"
            :placeholder="editing ? 'leave blank to keep current' : 'provider credential'"
          />
        </label>
        <label class="field">
          Base URL
          <input v-model="form.baseUrl" class="inp" placeholder="optional custom endpoint" />
        </label>
        <label class="field">
          Options (JSON)
          <textarea
            v-model="form.options"
            class="inp font-mono text-xs"
            rows="4"
            placeholder='{ "temperature": 0.2 }'
          />
          <span class="text-xs text-neutral-500">
            Provider-specific knobs passed through on every call. Leave blank for none.
          </span>
        </label>
        <p v-if="formError" class="m-0 text-sm text-red-400">{{ formError }}</p>
        <div class="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="btn-ghost" @click="showForm = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>
