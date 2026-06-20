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
interface Project {
  id: number;
  name: string;
  clientId: number;
  clientName: string | null;
  stage: string;
}

const route = useRoute();
const clientId = Number(route.params.id);

const { user } = useAuth();
const canCreate = computed(() => (user.value?.permissions ?? []).includes('ADMIN'));

const { data: client, refresh, error } = await useAsyncData<Client | null>(`client-${clientId}`, () =>
  useApi<Client>(`/clients/${clientId}`).catch(() => null),
);
const { data: allProjects, refresh: refreshProjects } = await useAsyncData<Project[]>(
  `client-${clientId}-projects`,
  () => useApi<Project[]>('/projects').catch(() => []),
);
const projects = computed(() => (allProjects.value ?? []).filter((p) => p.clientId === clientId));

const clientDetails = computed(() => [
  { label: 'Email', value: client.value?.email },
  { label: 'Phone', value: client.value?.phone },
  { label: 'Address', value: client.value?.address },
  { label: 'Notes', value: client.value?.notes, pre: true },
]);

const projectColumns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'stage', label: 'Stage' },
];

// --- edit ---
const showForm = ref(false);
const saving = ref(false);
const formError = ref('');
const form = reactive({ name: '', email: '', phone: '', address: '', notes: '' });
function openEdit() {
  if (!client.value) return;
  Object.assign(form, {
    name: client.value.name,
    email: client.value.email ?? '',
    phone: client.value.phone ?? '',
    address: client.value.address ?? '',
    notes: client.value.notes ?? '',
  });
  formError.value = '';
  showForm.value = true;
}
async function save() {
  saving.value = true;
  formError.value = '';
  try {
    await useApi(`/clients/${clientId}`, {
      method: 'PATCH',
      body: {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
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
  if (!client.value) return;
  if (!(await confirm({
    title: `Delete client "${client.value.name}"?`,
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    tone: 'danger',
  }))) return;
  try {
    await useApi(`/clients/${clientId}`, { method: 'DELETE' });
    await navigateTo('/clients');
  } catch (e: any) {
    await alert({ title: 'Delete failed', message: e?.data?.message, tone: 'danger' });
  }
}

// --- create project for this client ---
const showProjectForm = ref(false);
const projectSaving = ref(false);
const projectError = ref('');
const projectForm = reactive({ name: '', briefing: '' });
function openProjectCreate() {
  Object.assign(projectForm, { name: '', briefing: '' });
  projectError.value = '';
  showProjectForm.value = true;
}
async function saveProject() {
  projectSaving.value = true;
  projectError.value = '';
  try {
    await useApi('/projects', {
      method: 'POST',
      body: { name: projectForm.name, clientId, briefing: projectForm.briefing || undefined },
    });
    showProjectForm.value = false;
    await Promise.all([refreshProjects(), refresh()]);
  } catch (e: any) {
    projectError.value = e?.data?.message ?? 'Save failed';
  } finally {
    projectSaving.value = false;
  }
}
</script>

<template>
  <div>
    <NuxtLink to="/clients" class="text-sm text-neutral-400 hover:text-brand">← Clients</NuxtLink>

    <p v-if="error || !client" class="mt-4 text-sm text-neutral-500">Client not found.</p>

    <template v-else>
      <div class="mb-5 mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <div class="kicker">// client</div>
          <h1 class="m-0 break-words text-2xl font-bold tracking-tight text-white">{{ client.name }}</h1>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <button class="btn-danger" @click="remove">Delete</button>
          <button class="btn-primary" @click="openEdit">Edit</button>
        </div>
      </div>

      <div class="mb-8 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <DetailList :items="clientDetails" />
      </div>

      <DataGrid
        title="Projects"
        :creatable="canCreate"
        :columns="projectColumns"
        :rows="projects"
        empty-text="No projects for this client yet."
        @create="openProjectCreate"
        @view="navigateTo(`/projects/${$event.id}`)"
      />
    </template>

    <Modal v-if="showProjectForm" :title="`New project for ${client?.name}`" @close="showProjectForm = false">
      <form class="flex flex-col gap-3" @submit.prevent="saveProject">
        <label class="field">Name<input v-model="projectForm.name" class="inp" required /></label>
        <label class="field">Briefing<textarea v-model="projectForm.briefing" rows="4" class="inp" /></label>
        <p v-if="projectError" class="m-0 text-sm text-red-400">{{ projectError }}</p>
        <div class="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="btn-ghost" @click="showProjectForm = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="projectSaving">
            {{ projectSaving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </Modal>

    <Modal v-if="showForm" title="Edit client" @close="showForm = false">
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <label class="field">Name<input v-model="form.name" class="inp" required /></label>
        <label class="field">Email<input v-model="form.email" type="email" class="inp" /></label>
        <label class="field">Phone<input v-model="form.phone" class="inp" /></label>
        <label class="field">Address<input v-model="form.address" class="inp" /></label>
        <label class="field">Notes<textarea v-model="form.notes" rows="3" class="inp" /></label>
        <p v-if="formError" class="m-0 text-sm text-red-400">{{ formError }}</p>
        <div class="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="btn-ghost" @click="showForm = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
