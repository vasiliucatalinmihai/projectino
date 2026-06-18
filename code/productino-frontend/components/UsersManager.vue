<script setup lang="ts">
/**
 * User list + view/edit/create for one account. Reused on the standalone Users
 * page (no prop → the caller's own account; all accounts for a super admin) and
 * on the Account page (scoped to a specific accountId).
 */
const props = defineProps<{ accountId?: number }>();

interface ManagedUser {
  id: number;
  email: string;
  name: string | null;
  accountId: number;
  account?: { id: number; name: string; isSystem: boolean } | null;
  permissions: string[];
  isSuperAdmin: boolean;
  active: boolean;
  activationToken: string | null;
  createdAt: string;
}

const { user } = useAuth();
const canManage = computed(
  () => !!user.value?.isSuperAdmin || (user.value?.permissions ?? []).includes('ADMIN'),
);
// Moving a user to another account is super-admin only (and only a real super
// admin — not while impersonating, where isSuperAdmin is false).
const isSuperAdmin = computed(() => !!user.value?.isSuperAdmin);

interface AccountOption {
  id: number;
  name: string;
}
const { data: accounts } = await useAsyncData<AccountOption[]>(
  `users-mgr-accounts-${props.accountId ?? 'self'}`,
  () => (user.value?.isSuperAdmin ? useApi<AccountOption[]>('/accounts').catch(() => []) : Promise.resolve([])),
);

// Tenant admins cannot grant SUPER_ADMIN, so it's not offered here.
const PERMS = ['ADMIN', 'VIEW_ONLY', 'RUN_LLM', 'UPDATE_SETTINGS', 'MANAGE_PROMPTS'];

const scope = props.accountId != null ? `?accountId=${props.accountId}` : '';
const { data: users, refresh, error } = await useAsyncData<ManagedUser[]>(
  `account-users-${props.accountId ?? 'self'}`,
  () => useApi<ManagedUser[]>(`/users${scope}`).catch(() => []),
);

const columns = [
  { key: 'email', label: 'Email' },
  { key: 'name', label: 'Name' },
  { key: 'permsLabel', label: 'Permissions' },
  { key: 'activeLabel', label: 'Active' },
];
const rows = computed(() =>
  (users.value ?? [])
    .filter((u) => user.value?.isSuperAdmin || !u.permissions.includes('SUPER_ADMIN'))
    .map((u) => ({
      ...u,
      permsLabel: u.permissions.join(' · ') || '—',
      activeLabel: u.active ? '● yes' : '○ no',
    })),
);

// --- view ---
const viewing = ref<ManagedUser | null>(null);
function openView(row: ManagedUser) {
  // Re-resolve from `users` so refreshes update the modal contents.
  viewing.value = users.value?.find((u) => u.id === row.id) ?? row;
}

// --- create / edit ---
const showForm = ref(false);
const editing = ref<ManagedUser | null>(null);
const saving = ref(false);
const formError = ref('');
const form = reactive({
  email: '',
  name: '',
  permissions: [] as string[],
  active: true,
  accountId: undefined as number | undefined,
});

function openCreate() {
  editing.value = null;
  viewing.value = null;
  Object.assign(form, { email: '', name: '', permissions: ['VIEW_ONLY'], active: true });
  formError.value = '';
  showForm.value = true;
}
function openEdit() {
  if (!viewing.value) return;
  editing.value = viewing.value;
  Object.assign(form, {
    email: viewing.value.email,
    name: viewing.value.name ?? '',
    permissions: [...viewing.value.permissions],
    active: viewing.value.active,
    accountId: viewing.value.accountId,
  });
  viewing.value = null;
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
          active: form.active,
          // Account moves are super-admin only; only send it when allowed.
          ...(isSuperAdmin.value ? { accountId: form.accountId } : {}),
        },
      });
    } else {
      // Create returns the new user (including activationToken); show it in the view.
      const created = await useApi<ManagedUser>('/users', {
        method: 'POST',
        body: {
          email: form.email,
          name: form.name || undefined,
          permissions: form.permissions,
          // Scope the new user to this account when the manager is account-scoped
          // (honored for super admins; ignored for tenant admins).
          ...(props.accountId != null ? { accountId: props.accountId } : {}),
        },
      });
      showForm.value = false;
      await refresh();
      viewing.value = created; // open view so admin can copy the activation link
      return;
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
async function resetPassword() {
  if (!viewing.value) return;
  if (!(await confirm({
    title: `Reset password for ${viewing.value.email}?`,
    message: "Their current password will be cleared and they'll need the new activation link to set a new one.",
    confirmLabel: 'Reset',
    tone: 'warning',
  }))) return;
  try {
    const updated = await useApi<ManagedUser>(`/users/${viewing.value.id}/reset-password`, {
      method: 'POST',
    });
    await refresh();
    viewing.value = updated; // show the new token in the modal
  } catch (e: any) {
    await alert({ title: 'Reset failed', message: e?.data?.message, tone: 'danger' });
  }
}

async function remove() {
  if (!viewing.value) return;
  const target = viewing.value;
  if (!(await confirm({
    title: `Delete user ${target.email}?`,
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    tone: 'danger',
  }))) return;
  try {
    await useApi(`/users/${target.id}`, { method: 'DELETE' });
    viewing.value = null;
    await refresh();
  } catch (e: any) {
    await alert({ title: 'Delete failed', message: e?.data?.message, tone: 'danger' });
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
      :columns="columns"
      :rows="rows"
      empty-text="No users yet."
      @create="openCreate"
      @view="openView"
    />

    <UserViewModal
      v-if="viewing"
      :user="viewing"
      :can-manage="canManage"
      :is-self="viewing.id === user?.id"
      @close="viewing = null"
      @edit="openEdit"
      @remove="remove"
      @reset-password="resetPassword"
    />

    <Modal v-if="showForm" :title="editing ? 'Edit user' : 'Create user'" @close="showForm = false">
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <label class="field">
          Email
          <input
            v-model="form.email"
            type="email"
            class="inp disabled:bg-neutral-800 disabled:text-neutral-500"
            :disabled="!!editing"
            required
          />
        </label>
        <label class="field">Name<input v-model="form.name" class="inp" /></label>
        <label v-if="editing" class="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
          <input v-model="form.active" type="checkbox" class="accent-green-500" />
          Active
          <span class="text-xs text-neutral-500">(inactive users cannot log in)</span>
        </label>
        <label v-if="editing && isSuperAdmin" class="field">
          Account
          <select v-model.number="form.accountId" class="inp">
            <option v-for="a in accounts ?? []" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
          <span class="text-xs text-neutral-500">Move this user to another account.</span>
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
              <input
                type="checkbox"
                class="accent-green-500"
                :checked="form.permissions.includes(p)"
                @change="togglePerm(p)"
              />
              {{ p }}
            </label>
          </div>
        </div>
        <p v-if="!editing" class="m-0 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-400">
          The user will be created <strong class="text-amber-300">inactive</strong>. After saving, you'll get
          a one-shot activation link to share — they'll set their own password through it.
        </p>
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
