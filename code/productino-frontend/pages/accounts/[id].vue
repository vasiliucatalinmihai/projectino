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

const route = useRoute();
const accountId = Number(route.params.id);
const { user: currentUser, impersonate } = useAuth();

const PERMS = ['SUPER_ADMIN', 'ADMIN', 'VIEW_ONLY', 'RUN_LLM', 'UPDATE_SETTINGS', 'MANAGE_PROMPTS'];

const { data: account, refresh: refreshAccount, error } = await useAsyncData<Account | null>(
  `account-${accountId}`,
  () => useApi<Account>(`/accounts/${accountId}`).catch(() => null),
);
const { data: users, refresh: refreshUsers } = await useAsyncData<ManagedUser[]>(
  `account-${accountId}-users`,
  () => useApi<ManagedUser[]>(`/users?accountId=${accountId}`).catch(() => []),
);

const accountDetails = computed(() => [
  { label: 'ID', value: account.value?.id },
  { label: 'Slug', value: account.value?.slug },
  { label: 'System', value: account.value?.isSystem ? 'yes' : 'no' },
  { label: 'BYO AI', value: account.value?.bringYourOwnAi ? 'yes' : 'no' },
  { label: 'Users', value: account.value?.userCount },
]);

const userColumns = [
  { key: 'email', label: 'Email' },
  { key: 'name', label: 'Name' },
  { key: 'permsLabel', label: 'Permissions' },
  { key: 'activeLabel', label: 'Active' },
];
const userRows = computed(() =>
  (users.value ?? []).map((u) => ({
    ...u,
    permsLabel: u.permissions.join(' · ') || '—',
    activeLabel: u.active ? '● yes' : '○ no',
  })),
);

// --- account edit ---
const showAccountForm = ref(false);
const savingAccount = ref(false);
const accountError = ref('');
const accountForm = reactive({ name: '', slug: '', bringYourOwnAi: false });
function openAccountEdit() {
  if (!account.value) return;
  Object.assign(accountForm, {
    name: account.value.name,
    slug: account.value.slug ?? '',
    bringYourOwnAi: account.value.bringYourOwnAi,
  });
  accountError.value = '';
  showAccountForm.value = true;
}
async function saveAccount() {
  savingAccount.value = true;
  accountError.value = '';
  try {
    await useApi(`/accounts/${accountId}`, {
      method: 'PATCH',
      body: {
        name: accountForm.name,
        slug: accountForm.slug || undefined,
        bringYourOwnAi: accountForm.bringYourOwnAi,
      },
    });
    showAccountForm.value = false;
    await refreshAccount();
  } catch (e: any) {
    accountError.value = e?.data?.message ?? 'Save failed';
  } finally {
    savingAccount.value = false;
  }
}

// --- user view / create / edit / reset ---
const viewingUser = ref<ManagedUser | null>(null);
function openUserView(row: ManagedUser) {
  viewingUser.value = users.value?.find((u) => u.id === row.id) ?? row;
}

const showUserForm = ref(false);
const editingUser = ref<ManagedUser | null>(null);
const savingUser = ref(false);
const userError = ref('');
const userForm = reactive({
  email: '',
  name: '',
  permissions: [] as string[],
  active: true,
  accountId: accountId as number,
});

// All accounts, for the "move user to another account" dropdown.
interface AccountOption {
  id: number;
  name: string;
}
const { data: allAccounts } = await useAsyncData<AccountOption[]>('accounts-all', () =>
  useApi<AccountOption[]>('/accounts').catch(() => []),
);

function openUserCreate() {
  editingUser.value = null;
  viewingUser.value = null;
  Object.assign(userForm, { email: '', name: '', permissions: ['VIEW_ONLY'], active: true });
  userError.value = '';
  showUserForm.value = true;
}
function openUserEdit() {
  if (!viewingUser.value) return;
  editingUser.value = viewingUser.value;
  Object.assign(userForm, {
    email: viewingUser.value.email,
    name: viewingUser.value.name ?? '',
    permissions: [...viewingUser.value.permissions],
    active: viewingUser.value.active,
    accountId: viewingUser.value.accountId,
  });
  viewingUser.value = null;
  userError.value = '';
  showUserForm.value = true;
}
function togglePerm(p: string) {
  const i = userForm.permissions.indexOf(p);
  if (i === -1) userForm.permissions.push(p);
  else userForm.permissions.splice(i, 1);
}
async function saveUser() {
  savingUser.value = true;
  userError.value = '';
  try {
    if (editingUser.value) {
      await useApi(`/users/${editingUser.value.id}`, {
        method: 'PATCH',
        body: {
          name: userForm.name || null,
          permissions: userForm.permissions,
          active: userForm.active,
          accountId: userForm.accountId,
        },
      });
      showUserForm.value = false;
      await Promise.all([refreshUsers(), refreshAccount()]);
    } else {
      const created = await useApi<ManagedUser>('/users', {
        method: 'POST',
        body: {
          email: userForm.email,
          name: userForm.name || undefined,
          permissions: userForm.permissions,
          accountId,
        },
      });
      showUserForm.value = false;
      await Promise.all([refreshUsers(), refreshAccount()]);
      viewingUser.value = created; // open the view so the admin can copy the activation link
    }
  } catch (e: any) {
    userError.value = e?.data?.message ?? 'Save failed';
  } finally {
    savingUser.value = false;
  }
}
const { confirm, alert } = useConfirm();
async function resetUser() {
  if (!viewingUser.value) return;
  if (!(await confirm({
    title: `Reset password for ${viewingUser.value.email}?`,
    message: "Their current password will be cleared and they'll need the new activation link to set a new one.",
    confirmLabel: 'Reset',
    tone: 'warning',
  }))) return;
  try {
    const updated = await useApi<ManagedUser>(`/users/${viewingUser.value.id}/reset-password`, {
      method: 'POST',
    });
    await Promise.all([refreshUsers(), refreshAccount()]);
    viewingUser.value = updated;
  } catch (e: any) {
    await alert({ title: 'Reset failed', message: e?.data?.message, tone: 'danger' });
  }
}
async function removeUser() {
  if (!viewingUser.value) return;
  const target = viewingUser.value;
  if (!(await confirm({
    title: `Delete user ${target.email}?`,
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    tone: 'danger',
  }))) return;
  try {
    await useApi(`/users/${target.id}`, { method: 'DELETE' });
    viewingUser.value = null;
    await Promise.all([refreshUsers(), refreshAccount()]);
  } catch (e: any) {
    await alert({ title: 'Delete failed', message: e?.data?.message, tone: 'danger' });
  }
}

const showImpersonate = ref(false);
const impersonateError = ref('');
function openImpersonate() {
  impersonateError.value = '';
  showImpersonate.value = true;
}
function closeImpersonate() {
  showImpersonate.value = false;
  impersonateError.value = '';
}
async function confirmImpersonate() {
  impersonateError.value = '';
  try {
    await impersonate(accountId); // navigates away on success
  } catch (e: any) {
    impersonateError.value = e?.data?.message ?? 'Impersonation failed';
  }
}
</script>

<template>
  <div>
    <NuxtLink to="/accounts" class="text-sm text-neutral-400 hover:text-brand">← Accounts</NuxtLink>

    <p v-if="error || !account" class="mt-4 text-sm text-neutral-500">Account not found.</p>

    <template v-else>
      <div class="mb-5 mt-2 flex items-start justify-between">
        <div>
          <div class="kicker">// account</div>
          <h1 class="m-0 text-2xl font-bold tracking-tight text-white">{{ account.name }}</h1>
        </div>
        <div class="flex gap-2">
          <button class="btn-ghost" @click="openImpersonate">Impersonate</button>
          <button class="btn-primary" @click="openAccountEdit">Edit</button>
        </div>
      </div>

      <div class="mb-8 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <DetailList :items="accountDetails" />
      </div>

      <DataGrid
        title="Users"
        creatable
        :columns="userColumns"
        :rows="userRows"
        @create="openUserCreate"
        @view="openUserView"
      />

      <div class="mt-8">
        <div class="kicker">// ai models</div>
        <h2 class="m-0 mb-3 text-xl font-bold tracking-tight text-white">AI Models</h2>
        <AiModelsManager :account-id="accountId" />
      </div>
    </template>

    <UserViewModal
      v-if="viewingUser"
      :user="viewingUser"
      :can-manage="true"
      :is-self="viewingUser.id === currentUser?.id"
      @close="viewingUser = null"
      @edit="openUserEdit"
      @remove="removeUser"
      @reset-password="resetUser"
    />

    <ImpersonateModal
      v-if="showImpersonate && account"
      :account="account.name"
      :error="impersonateError"
      @confirm="confirmImpersonate"
      @close="closeImpersonate"
    />

    <!-- Account edit modal -->
    <Modal v-if="showAccountForm" title="Edit account" @close="showAccountForm = false">
      <form class="flex flex-col gap-3" @submit.prevent="saveAccount">
        <label class="field">Name<input v-model="accountForm.name" class="inp" required /></label>
        <label class="field">Slug<input v-model="accountForm.slug" class="inp" placeholder="lowercase-dashes" /></label>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
          <input v-model="accountForm.bringYourOwnAi" type="checkbox" class="accent-green-500" />
          Bring your own AI
          <span class="text-xs text-neutral-500">(use this account's own models)</span>
        </label>
        <p v-if="accountError" class="m-0 text-sm text-red-400">{{ accountError }}</p>
        <div class="mt-1 flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showAccountForm = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="savingAccount">{{ savingAccount ? 'Saving…' : 'Save' }}</button>
        </div>
      </form>
    </Modal>

    <!-- User create / edit modal -->
    <Modal v-if="showUserForm" :title="editingUser ? 'Edit user' : 'Create user'" @close="showUserForm = false">
      <form class="flex flex-col gap-3" @submit.prevent="saveUser">
        <label class="field">
          Email
          <input v-model="userForm.email" type="email" class="inp disabled:bg-neutral-800 disabled:text-neutral-500" :disabled="!!editingUser" required />
        </label>
        <label class="field">Name<input v-model="userForm.name" class="inp" /></label>
        <label v-if="editingUser" class="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
          <input v-model="userForm.active" type="checkbox" class="accent-green-500" />
          Active
          <span class="text-xs text-neutral-500">(inactive users cannot log in)</span>
        </label>
        <label v-if="editingUser" class="field">
          Account
          <select v-model.number="userForm.accountId" class="inp">
            <option v-for="a in allAccounts ?? []" :key="a.id" :value="a.id">{{ a.name }}</option>
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
              :class="userForm.permissions.includes(p) ? 'border-brand/50 text-brand' : 'border-neutral-700 text-neutral-400'"
            >
              <input type="checkbox" class="accent-green-500" :checked="userForm.permissions.includes(p)" @change="togglePerm(p)" />
              {{ p }}
            </label>
          </div>
        </div>
        <p v-if="!editingUser" class="m-0 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-400">
          Created <strong class="text-amber-300">inactive</strong> with a one-shot activation link — share it so the user can set their password.
        </p>
        <p v-if="userError" class="m-0 text-sm text-red-400">{{ userError }}</p>
        <div class="mt-1 flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showUserForm = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="savingUser">{{ savingUser ? 'Saving…' : 'Save' }}</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
