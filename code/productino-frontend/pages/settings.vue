<script setup lang="ts">
interface Setting {
  id: number;
  key: string;
  value: string;
  description: string | null;
}

const { data: settings, refresh } = await useAsyncData<Setting[]>('settings', () =>
  useApi<Setting[]>('/settings').catch(() => []),
);

const columns = [
  { key: 'key', label: 'Key' },
  { key: 'value', label: 'Value' },
  { key: 'description', label: 'Description' },
];

// --- view ---
const viewing = ref<Setting | null>(null);

// --- create / edit ---
const showForm = ref(false);
const editing = ref<Setting | null>(null);
const saving = ref(false);
const formError = ref('');
const form = reactive({ key: '', value: '', description: '' });

function openCreate() {
  editing.value = null;
  Object.assign(form, { key: '', value: '', description: '' });
  formError.value = '';
  showForm.value = true;
}

function openEdit(row: Setting) {
  viewing.value = null;
  editing.value = row;
  Object.assign(form, { key: row.key, value: row.value, description: row.description ?? '' });
  formError.value = '';
  showForm.value = true;
}

async function save() {
  saving.value = true;
  formError.value = '';
  try {
    if (editing.value) {
      // Key is immutable on edit — only value/description change.
      await useApi(`/settings/${editing.value.id}`, {
        method: 'PATCH',
        body: { value: form.value, description: form.description || null },
      });
    } else {
      await useApi('/settings', {
        method: 'POST',
        body: { key: form.key, value: form.value, description: form.description || undefined },
      });
    }
    showForm.value = false;
    await refresh();
  } catch (e: any) {
    formError.value = e?.data?.message ?? 'Save failed';
  } finally {
    saving.value = false;
  }
}

const { confirm, alert } = useConfirm();
async function remove(row: Setting) {
  if (!(await confirm({
    title: `Delete setting "${row.key}"?`,
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    tone: 'danger',
  }))) return;
  try {
    await useApi(`/settings/${row.id}`, { method: 'DELETE' });
    viewing.value = null;
    await refresh();
  } catch (e: any) {
    await alert({ title: 'Delete failed', message: e?.data?.message, tone: 'danger' });
  }
}
</script>

<template>
  <div>
    <DataGrid
      title="Settings"
      creatable
      editable
      deletable
      :columns="columns"
      :rows="settings ?? []"
      @create="openCreate"
      @view="viewing = $event"
      @edit="openEdit"
      @remove="remove"
    />

    <!-- View -->
    <Modal v-if="viewing" :title="viewing.key" @close="viewing = null">
      <dl class="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
        <dt class="text-xs text-neutral-400">ID</dt>
        <dd class="m-0 text-sm">{{ viewing.id }}</dd>
        <dt class="text-xs text-neutral-400">Key</dt>
        <dd class="m-0 text-sm">{{ viewing.key }}</dd>
        <dt class="text-xs text-neutral-400">Value</dt>
        <dd class="m-0 break-words text-sm">{{ viewing.value }}</dd>
        <dt class="text-xs text-neutral-400">Description</dt>
        <dd class="m-0 text-sm">{{ viewing.description ?? '—' }}</dd>
      </dl>
      <div class="mt-5 flex justify-end gap-2">
        <button class="btn-danger" @click="remove(viewing)">Delete</button>
        <button class="btn-primary" @click="openEdit(viewing)">Edit</button>
      </div>
    </Modal>

    <!-- Create / Edit -->
    <Modal
      v-if="showForm"
      :title="editing ? 'Edit setting' : 'Create setting'"
      @close="showForm = false"
    >
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <label class="field">
          Key
          <input v-model="form.key" class="inp disabled:bg-neutral-800 disabled:text-neutral-500" :disabled="!!editing" required />
        </label>
        <label class="field">
          Value
          <input v-model="form.value" class="inp" required />
        </label>
        <label class="field">
          Description
          <input v-model="form.description" class="inp" />
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
