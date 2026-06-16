<script setup lang="ts">
interface Client {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  projectCount: number;
}

const { data: clients, refresh } = await useAsyncData<Client[]>('clients', () =>
  useApi<Client[]>('/clients').catch(() => []),
);

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'projectCount', label: 'Projects', align: 'right' as const },
];

const showForm = ref(false);
const editing = ref<Client | null>(null);
const saving = ref(false);
const formError = ref('');
const form = reactive({ name: '', email: '', phone: '', address: '', notes: '' });

function openCreate() {
  editing.value = null;
  Object.assign(form, { name: '', email: '', phone: '', address: '', notes: '' });
  formError.value = '';
  showForm.value = true;
}
function openEdit(row: Client) {
  editing.value = row;
  Object.assign(form, {
    name: row.name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    address: row.address ?? '',
    notes: row.notes ?? '',
  });
  formError.value = '';
  showForm.value = true;
}
async function save() {
  saving.value = true;
  formError.value = '';
  const body = {
    name: form.name,
    email: form.email || undefined,
    phone: form.phone || undefined,
    address: form.address || undefined,
    notes: form.notes || undefined,
  };
  try {
    if (editing.value) await useApi(`/clients/${editing.value.id}`, { method: 'PATCH', body });
    else await useApi('/clients', { method: 'POST', body });
    showForm.value = false;
    await refresh();
  } catch (e: any) {
    formError.value = e?.data?.message ?? 'Save failed';
  } finally {
    saving.value = false;
  }
}
const { confirm, alert } = useConfirm();
async function remove(row: Client) {
  if (!(await confirm({
    title: `Delete client "${row.name}"?`,
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    tone: 'danger',
  }))) return;
  try {
    await useApi(`/clients/${row.id}`, { method: 'DELETE' });
    await refresh();
  } catch (e: any) {
    await alert({ title: 'Delete failed', message: e?.data?.message, tone: 'danger' });
  }
}
</script>

<template>
  <div>
    <DataGrid
      title="Clients"
      creatable
      editable
      deletable
      :columns="columns"
      :rows="clients ?? []"
      @create="openCreate"
      @view="navigateTo(`/clients/${$event.id}`)"
      @edit="openEdit"
      @remove="remove"
    />

    <Modal
      v-if="showForm"
      :title="editing ? 'Edit client' : 'Create client'"
      @close="showForm = false"
    >
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <label class="field">Name<input v-model="form.name" class="inp" required /></label>
        <label class="field">Email<input v-model="form.email" type="email" class="inp" /></label>
        <label class="field">Phone<input v-model="form.phone" class="inp" /></label>
        <label class="field">Address<input v-model="form.address" class="inp" /></label>
        <label class="field">Notes<textarea v-model="form.notes" rows="3" class="inp" /></label>
        <p v-if="formError" class="m-0 text-sm text-red-400">{{ formError }}</p>
        <div class="mt-1 flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showForm = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
