<script setup lang="ts">
interface Project {
  id: number;
  name: string;
  clientId: number;
  clientName: string | null;
  accountName: string | null;
  stage: string;
}
interface ClientOption {
  id: number;
  name: string;
}

const { user } = useAuth();
const isSuperAdmin = computed(() => !!user.value?.isSuperAdmin);
// Everyone manages their own account's projects; super admins use impersonation
// for other accounts, so a super admin creates within their own account here.
const canCreate = computed(
  () => isSuperAdmin.value || (user.value?.permissions ?? []).includes('ADMIN'),
);

const { data: projects, refresh } = await useAsyncData<Project[]>('projects', () =>
  useApi<Project[]>('/projects').catch(() => []),
);
const { data: clients } = await useAsyncData<ClientOption[]>('projects-clients', () =>
  canCreate.value ? useApi<ClientOption[]>('/clients').catch(() => []) : Promise.resolve([]),
);
const hasClients = computed(() => (clients.value?.length ?? 0) > 0);

// Super admins see projects across every account, so show which one each belongs to.
const columns = computed(() => [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  ...(isSuperAdmin.value ? [{ key: 'accountName', label: 'Account' }] : []),
  { key: 'clientName', label: 'Client' },
  { key: 'stage', label: 'Stage' },
]);

const showForm = ref(false);
const saving = ref(false);
const formError = ref('');
const form = reactive({ name: '', clientId: undefined as number | undefined, briefing: '' });

function openCreate() {
  Object.assign(form, { name: '', clientId: clients.value?.[0]?.id, briefing: '' });
  formError.value = '';
  showForm.value = true;
}
async function save() {
  saving.value = true;
  formError.value = '';
  try {
    await useApi('/projects', {
      method: 'POST',
      body: { name: form.name, clientId: form.clientId, briefing: form.briefing || undefined },
    });
    showForm.value = false;
    await refresh();
  } catch (e: any) {
    formError.value = e?.data?.message ?? 'Save failed';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <DataGrid
      title="Projects"
      :creatable="canCreate"
      :columns="columns"
      :rows="projects ?? []"
      empty-text="No projects yet."
      @create="openCreate"
      @view="navigateTo(`/projects/${$event.id}`)"
    />

    <Modal v-if="showForm" title="Create project" @close="showForm = false">
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <label class="field">Name<input v-model="form.name" class="inp" required /></label>
        <label class="field">
          Client
          <select v-model="form.clientId" class="inp" required :disabled="!hasClients">
            <option v-for="c in clients ?? []" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <NuxtLink v-if="!hasClients" to="/clients" class="mt-1 text-xs text-brand">
            No clients yet — create one first →
          </NuxtLink>
        </label>
        <label class="field">Briefing<textarea v-model="form.briefing" rows="4" class="inp" /></label>
        <p v-if="formError" class="m-0 text-sm text-red-400">{{ formError }}</p>
        <div class="mt-1 flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showForm = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="saving || !hasClients">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>
