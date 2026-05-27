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
  permissions: string[];
  createdAt: string;
}

const route = useRoute();
const accountId = Number(route.params.id);
const { impersonate } = useAuth();

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
];
const userRows = computed(() =>
  (users.value ?? []).map((u) => ({ ...u, permsLabel: u.permissions.join(' · ') || '—' })),
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

// --- user create / edit ---
const showUserForm = ref(false);
const editingUser = ref<ManagedUser | null>(null);
const savingUser = ref(false);
const userError = ref('');
const userForm = reactive({ email: '', name: '', password: '', permissions: [] as string[] });

function openUserCreate() {
  editingUser.value = null;
  Object.assign(userForm, { email: '', name: '', password: '', permissions: ['VIEW_ONLY'] });
  userError.value = '';
  showUserForm.value = true;
}
function openUserEdit(u: ManagedUser) {
  editingUser.value = u;
  Object.assign(userForm, {
    email: u.email,
    name: u.name ?? '',
    password: '',
    permissions: [...u.permissions],
  });
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
          ...(userForm.password ? { password: userForm.password } : {}),
        },
      });
    } else {
      await useApi('/users', {
        method: 'POST',
        body: {
          email: userForm.email,
          name: userForm.name || undefined,
          password: userForm.password,
          permissions: userForm.permissions,
          accountId,
        },
      });
    }
    showUserForm.value = false;
    await Promise.all([refreshUsers(), refreshAccount()]);
  } catch (e: any) {
    userError.value = e?.data?.message ?? 'Save failed';
  } finally {
    savingUser.value = false;
  }
}
async function removeUser(u: ManagedUser) {
  if (!confirm(`Delete user "${u.email}"?`)) return;
  try {
    await useApi(`/users/${u.id}`, { method: 'DELETE' });
    await Promise.all([refreshUsers(), refreshAccount()]);
  } catch (e: any) {
    alert(e?.data?.message ?? 'Delete failed');
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
        editable
        deletable
        :clickable="false"
        :columns="userColumns"
        :rows="userRows"
        @create="openUserCreate"
        @edit="openUserEdit"
        @remove="removeUser"
      />
    </template>

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
        <label class="field">
          {{ editingUser ? 'New password (optional)' : 'Password' }}
          <input v-model="userForm.password" type="password" class="inp" :required="!editingUser" autocomplete="new-password" />
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
        <p v-if="userError" class="m-0 text-sm text-red-400">{{ userError }}</p>
        <div class="mt-1 flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showUserForm = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="savingUser">{{ savingUser ? 'Saving…' : 'Save' }}</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
