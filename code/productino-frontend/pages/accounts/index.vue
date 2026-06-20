<script setup lang="ts">
interface Account {
  id: number;
  name: string;
  slug: string | null;
  isSystem: boolean;
  bringYourOwnAi: boolean;
  userCount: number;
  createdAt: string;
}

const { impersonate } = useAuth();

const { data: accounts, refresh, error } = await useAsyncData<Account[]>('accounts', () =>
  useApi<Account[]>('/accounts').catch(() => []),
);

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'slug', label: 'Slug' },
  { key: 'userCount', label: 'Users', align: 'right' as const },
];

const showForm = ref(false);
const editing = ref<Account | null>(null);
const saving = ref(false);
const formError = ref('');
const form = reactive({ name: '', slug: '', bringYourOwnAi: false });

function openCreate() {
  editing.value = null;
  Object.assign(form, { name: '', slug: '', bringYourOwnAi: false });
  formError.value = '';
  showForm.value = true;
}
function openEdit(row: Account) {
  editing.value = row;
  Object.assign(form, { name: row.name, slug: row.slug ?? '', bringYourOwnAi: row.bringYourOwnAi });
  formError.value = '';
  showForm.value = true;
}
async function save() {
  saving.value = true;
  formError.value = '';
  try {
    const body: Record<string, any> = { name: form.name, slug: form.slug || undefined };
    if (editing.value) {
      body.bringYourOwnAi = form.bringYourOwnAi;
      await useApi(`/accounts/${editing.value.id}`, { method: 'PATCH', body });
    } else await useApi('/accounts', { method: 'POST', body });
    showForm.value = false;
    await refresh();
  } catch (e: any) {
    formError.value = e?.data?.message ?? 'Save failed';
  } finally {
    saving.value = false;
  }
}

const impersonateTarget = ref<Account | null>(null);
const impersonateError = ref('');
function onAction({ key, row }: { key: string; row: Account }) {
  if (key === 'impersonate') {
    impersonateError.value = '';
    impersonateTarget.value = row;
  }
}
function closeImpersonate() {
  impersonateTarget.value = null;
  impersonateError.value = '';
}
async function confirmImpersonate() {
  if (!impersonateTarget.value) return;
  impersonateError.value = '';
  try {
    await impersonate(impersonateTarget.value.id); // navigates away on success
  } catch (e: any) {
    impersonateError.value = e?.data?.message ?? 'Impersonation failed';
  }
}
</script>

<template>
  <div>
    <p v-if="error" class="text-sm text-neutral-500">Requires the SUPER_ADMIN permission.</p>
    <DataGrid
      v-else
      title="Accounts"
      creatable
      editable
      :columns="columns"
      :rows="accounts ?? []"
      :extra-actions="[{ key: 'impersonate', label: 'Impersonate', variant: 'brand' }]"
      @create="openCreate"
      @view="navigateTo(`/accounts/${$event.id}`)"
      @edit="openEdit"
      @action="onAction"
    />

    <ImpersonateModal
      v-if="impersonateTarget"
      :account="impersonateTarget.name"
      :error="impersonateError"
      @confirm="confirmImpersonate"
      @close="closeImpersonate"
    />

    <Modal v-if="showForm" :title="editing ? 'Edit account' : 'Create account'" @close="showForm = false">
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <label class="field">Name<input v-model="form.name" class="inp" required /></label>
        <label class="field">Slug<input v-model="form.slug" class="inp" placeholder="lowercase-dashes" /></label>
        <label v-if="editing" class="flex cursor-pointer flex-wrap items-center gap-2 text-sm text-neutral-300">
          <input v-model="form.bringYourOwnAi" type="checkbox" class="accent-green-500" />
          Bring your own AI
          <span class="text-xs text-neutral-500">(use this account's own models)</span>
        </label>
        <p v-if="formError" class="m-0 text-sm text-red-400">{{ formError }}</p>
        <div class="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="btn-ghost" @click="showForm = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
