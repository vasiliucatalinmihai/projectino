<script setup lang="ts">
interface AiModel {
  id: number;
  label: string | null;
  provider: string;
  model: string;
  baseUrl: string | null;
  isActive: boolean;
  hasKey: boolean;
  keyHint: string | null;
}
interface Effective {
  source: 'account' | 'platform';
  provider: string | null;
  model: string | null;
  configured: boolean;
}
interface CurrentAccount {
  name: string;
  bringYourOwnAi: boolean;
}

const { user } = useAuth();
const canManage = computed(
  () => !!user.value?.isSuperAdmin || (user.value?.permissions ?? []).includes('ADMIN'),
);

const { data: models, refresh } = await useAsyncData<AiModel[]>('ai-models', () =>
  useApi<AiModel[]>('/ai-models').catch(() => []),
);
const { data: effective, refresh: refreshEffective } = await useAsyncData<Effective | null>(
  'ai-effective',
  () => useApi<Effective>('/ai-models/effective').catch(() => null),
);
const { data: account } = await useAsyncData<CurrentAccount | null>('ai-account', () =>
  useApi<CurrentAccount>('/account').catch(() => null),
);

const byo = computed(() => !!account.value?.bringYourOwnAi);

const columns = [
  { key: 'label', label: 'Label' },
  { key: 'provider', label: 'Provider' },
  { key: 'model', label: 'Model' },
  { key: 'keyHint', label: 'Key' },
  { key: 'activeLabel', label: 'Active' },
];
const rows = computed(() =>
  (models.value ?? []).map((m) => ({
    ...m,
    label: m.label ?? '—',
    keyHint: m.keyHint ?? 'no key',
    activeLabel: m.isActive ? '● active' : '',
  })),
);

const PROVIDERS = ['anthropic', 'openai', 'google', 'azure-openai', 'mistral'];

const showForm = ref(false);
const editing = ref<AiModel | null>(null);
const saving = ref(false);
const formError = ref('');
const form = reactive({ label: '', provider: 'anthropic', model: '', apiKey: '', baseUrl: '' });

function openCreate() {
  editing.value = null;
  Object.assign(form, { label: '', provider: 'anthropic', model: '', apiKey: '', baseUrl: '' });
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
  });
  formError.value = '';
  showForm.value = true;
}
async function save() {
  saving.value = true;
  formError.value = '';
  const body: Record<string, any> = {
    label: form.label || undefined,
    provider: form.provider,
    model: form.model,
    baseUrl: form.baseUrl || undefined,
  };
  if (form.apiKey) body.apiKey = form.apiKey;
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
    <div class="mb-4">
      <div class="kicker">// ai models</div>
      <h1 class="m-0 text-2xl font-bold tracking-tight text-white">AI Models</h1>
    </div>

    <!-- Effective model + BYO status -->
    <div class="mb-5 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="font-mono text-xs uppercase tracking-wider text-neutral-500">// processing uses</span>
        <template v-if="effective?.configured">
          <span class="font-mono text-brand">{{ effective.provider }}/{{ effective.model }}</span>
          <span class="text-neutral-500">
            ({{ effective.source === 'account' ? 'your account' : 'platform default' }})
          </span>
        </template>
        <span v-else class="text-amber-300">
          Bring-your-own AI is on, but no active model is configured.
        </span>
      </div>
      <p class="mt-2 text-xs text-neutral-500">
        Bring your own AI:
        <span :class="byo ? 'text-brand' : 'text-neutral-400'">{{ byo ? 'ON' : 'OFF' }}</span>
        — set by a platform admin.
        <template v-if="!byo"> While off, your models are saved but the platform default is used.</template>
      </p>
    </div>

    <DataGrid
      :creatable="canManage"
      :editable="canManage"
      :deletable="canManage"
      :clickable="false"
      :columns="columns"
      :rows="rows"
      :extra-actions="canManage ? [{ key: 'activate', label: 'Set active', variant: 'brand' }] : []"
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
          <input v-model="form.provider" class="inp" list="ai-providers" required />
          <datalist id="ai-providers">
            <option v-for="p in PROVIDERS" :key="p" :value="p" />
          </datalist>
        </label>
        <label class="field">
          Model
          <input v-model="form.model" class="inp" placeholder="claude-opus-4-7" required />
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
