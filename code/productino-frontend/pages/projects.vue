<script setup lang="ts">
interface Project {
  id: number;
  name: string;
  clientName: string | null;
  briefing: string | null;
  stage: string;
}

const { data: projects, refresh } = await useAsyncData<Project[]>('projects', () =>
  useApi<Project[]>('/projects').catch(() => []),
);

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'clientName', label: 'Client' },
  { key: 'stage', label: 'Stage' },
];

const STAGES = [
  'BRIEFING',
  'GAP_ANALYSIS',
  'AWAITING_CLIENT',
  'DEFINITION',
  'PLANNING',
  'DELIVERY',
];

// --- view ---
const viewing = ref<Project | null>(null);

// --- create / edit ---
const showForm = ref(false);
const editing = ref<Project | null>(null);
const saving = ref(false);
const formError = ref('');
const form = reactive({ name: '', clientName: '', briefing: '', stage: 'BRIEFING' });

function openCreate() {
  editing.value = null;
  Object.assign(form, { name: '', clientName: '', briefing: '', stage: 'BRIEFING' });
  formError.value = '';
  showForm.value = true;
}

function openEdit(row: Project) {
  viewing.value = null;
  editing.value = row;
  Object.assign(form, {
    name: row.name,
    clientName: row.clientName ?? '',
    briefing: row.briefing ?? '',
    stage: row.stage,
  });
  formError.value = '';
  showForm.value = true;
}

async function save() {
  saving.value = true;
  formError.value = '';
  try {
    if (editing.value) {
      await useApi(`/projects/${editing.value.id}`, {
        method: 'PATCH',
        body: {
          name: form.name,
          clientName: form.clientName || null,
          briefing: form.briefing || null,
          stage: form.stage,
        },
      });
    } else {
      await useApi('/projects', {
        method: 'POST',
        body: {
          name: form.name,
          clientName: form.clientName || undefined,
          briefing: form.briefing || undefined,
        },
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

async function remove(row: Project) {
  if (!confirm(`Delete project "${row.name}"?`)) return;
  try {
    await useApi(`/projects/${row.id}`, { method: 'DELETE' });
    viewing.value = null;
    await refresh();
  } catch (e: any) {
    alert(e?.data?.message ?? 'Delete failed');
  }
}
</script>

<template>
  <div>
    <CrudGrid
      title="Projects"
      :columns="columns"
      :rows="projects ?? []"
      @create="openCreate"
      @view="viewing = $event"
      @edit="openEdit"
      @remove="remove"
    />

    <!-- View -->
    <Modal v-if="viewing" :title="viewing.name" @close="viewing = null">
      <dl class="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
        <dt class="text-xs text-neutral-400">ID</dt>
        <dd class="m-0 text-sm">{{ viewing.id }}</dd>
        <dt class="text-xs text-neutral-400">Client</dt>
        <dd class="m-0 text-sm">{{ viewing.clientName ?? '—' }}</dd>
        <dt class="text-xs text-neutral-400">Stage</dt>
        <dd class="m-0 text-sm">{{ viewing.stage }}</dd>
        <dt class="text-xs text-neutral-400">Briefing</dt>
        <dd class="m-0 whitespace-pre-wrap text-sm">{{ viewing.briefing ?? '—' }}</dd>
      </dl>
      <div class="mt-5 flex justify-end gap-2">
        <button class="btn-danger" @click="remove(viewing)">Delete</button>
        <button class="btn-primary" @click="openEdit(viewing)">Edit</button>
      </div>
    </Modal>

    <!-- Create / Edit -->
    <Modal
      v-if="showForm"
      :title="editing ? 'Edit project' : 'Create project'"
      @close="showForm = false"
    >
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <label class="field">
          Name
          <input v-model="form.name" class="inp" required />
        </label>
        <label class="field">
          Client
          <input v-model="form.clientName" class="inp" />
        </label>
        <label class="field">
          Briefing
          <textarea v-model="form.briefing" rows="4" class="inp" />
        </label>
        <label v-if="editing" class="field">
          Stage
          <select v-model="form.stage" class="inp">
            <option v-for="s in STAGES" :key="s" :value="s">{{ s }}</option>
          </select>
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
