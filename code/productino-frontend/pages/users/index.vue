<script setup lang="ts">
interface ManagedUser {
  id: number;
  email: string;
  name: string | null;
  accountId: number;
  permissions: string[];
  createdAt: string;
}

const { user } = useAuth();
// Only account admins (and super admins) can create/edit/delete; others view.
const canManage = computed(
  () => !!user.value?.isSuperAdmin || (user.value?.permissions ?? []).includes('ADMIN'),
);

// Tenant admins cannot grant SUPER_ADMIN, so it's not offered here.
const PERMS = ['ADMIN', 'VIEW_ONLY', 'RUN_LLM', 'UPDATE_SETTINGS', 'MANAGE_PROMPTS'];

const { data: users, refresh, error } = await useAsyncData<ManagedUser[]>('account-users', () =>
  useApi<ManagedUser[]>('/users').catch(() => []),
);

const columns = [
  { key: 'email', label: 'Email' },
  { key: 'name', label: 'Name' },
  { key: 'permsLabel', label: 'Permissions' },
];
// Hide platform super admins from a tenant admin's view.
const rows = computed(() =>
  (users.value ?? [])
    .filter((u) => user.value?.isSuperAdmin || !u.permissions.includes('SUPER_ADMIN'))
    .map((u) => ({ ...u, permsLabel: u.permissions.join(' · ') || '—' })),
);

const showForm = ref(false);
const editing = ref<ManagedUser | null>(null);
const saving = ref(false);
const formError = ref('');
const form = reactive({ email: '', name: '', password: '', permissions: [] as string[] });

function openCreate() {
  editing.value = null;
  Object.assign(form, { email: '', name: '', password: '', permissions: ['VIEW_ONLY'] });
  formError.value = '';
  showForm.value = true;
}
function openEdit(u: ManagedUser) {
  editing.value = u;
  Object.assign(form, {
    email: u.email,
    name: u.name ?? '',
    password: '',
    permissions: [...u.permissions],
  });
  formError.value = '';
  showForm.value = true;
}
function togglePerm(p: string) {
  const i = form.permissions.indexOf(p);
  if (i === -1) form.permissions.push(p);
  else form.permissions.splice(i, 1);
}
async function save() {
  saving.value = true;
  formError.value = '';
  try {
    if (editing.value) {
      await useApi(`/users/${editing.value.id}`, {
        method: 'PATCH',
        body: {
          name: form.name || null,
          permissions: form.permissions,
          ...(form.password ? { password: form.password } : {}),
        },
      });
    } else {
      await useApi('/users', {
        method: 'POST',
        body: {
          email: form.email,
          name: form.name || undefined,
          password: form.password,
          permissions: form.permissions,
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
async function remove(u: ManagedUser) {
  if (!confirm(`Delete user "${u.email}"?`)) return;
  try {
    await useApi(`/users/${u.id}`, { method: 'DELETE' });
    await refresh();
  } catch (e: any) {
    alert(e?.data?.message ?? 'Delete failed');
  }
}
</script>

<template>
  <div>
    <p v-if="error" class="text-sm text-neutral-500">You don't have access to view users.</p>
    <DataGrid
      v-else
      title="Users"
      :creatable="canManage"
      :editable="canManage"
      :deletable="canManage"
      :clickable="false"
      :columns="columns"
      :rows="rows"
      @create="openCreate"
      @edit="openEdit"
      @remove="remove"
    />

    <Modal v-if="showForm" :title="editing ? 'Edit user' : 'Create user'" @close="showForm = false">
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <label class="field">
          Email
          <input v-model="form.email" type="email" class="inp disabled:bg-neutral-800 disabled:text-neutral-500" :disabled="!!editing" required />
        </label>
        <label class="field">Name<input v-model="form.name" class="inp" /></label>
        <label class="field">
          {{ editing ? 'New password (optional)' : 'Password' }}
          <input v-model="form.password" type="password" class="inp" :required="!editing" autocomplete="new-password" />
        </label>
        <div class="field">
          Permissions
          <div class="flex flex-wrap gap-2 pt-1">
            <label
              v-for="p in PERMS"
              :key="p"
              class="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs"
              :class="form.permissions.includes(p) ? 'border-brand/50 text-brand' : 'border-neutral-700 text-neutral-400'"
            >
              <input type="checkbox" class="accent-green-500" :checked="form.permissions.includes(p)" @change="togglePerm(p)" />
              {{ p }}
            </label>
          </div>
        </div>
        <p v-if="formError" class="m-0 text-sm text-red-400">{{ formError }}</p>
        <div class="mt-1 flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showForm = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
