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

const { user } = useAuth();
const canEdit = computed(
  () => !!user.value?.isSuperAdmin || (user.value?.permissions ?? []).includes('ADMIN'),
);
const isSuperAdmin = computed(() => !!user.value?.isSuperAdmin);

const { data: account, refresh, error } = await useAsyncData<Account | null>('current-account', () =>
  useApi<Account>('/account').catch(() => null),
);

const form = reactive({ name: '', slug: '' });
watchEffect(() => {
  if (account.value) {
    form.name = account.value.name;
    form.slug = account.value.slug ?? '';
  }
});

const saving = ref(false);
const formError = ref('');
const saved = ref(false);
async function save() {
  saving.value = true;
  formError.value = '';
  saved.value = false;
  try {
    await useApi('/account', {
      method: 'PATCH',
      body: { name: form.name, slug: form.slug || undefined },
    });
    saved.value = true;
    await refresh();
  } catch (e: any) {
    formError.value = e?.data?.message ?? 'Save failed';
  } finally {
    saving.value = false;
  }
}

const readOnlyDetails = computed(() => [
  { label: 'Name', value: account.value?.name },
  { label: 'Slug', value: account.value?.slug },
  { label: 'BYO AI', value: account.value?.bringYourOwnAi ? 'yes' : 'no' },
  { label: 'Users', value: account.value?.userCount },
]);
</script>

<template>
  <div>
    <div class="kicker">// account</div>
    <h1 class="m-0 mb-1 text-2xl font-bold tracking-tight text-white">
      {{ account?.name ?? 'Account' }}
      <span
        v-if="account?.isSystem"
        class="ml-1 rounded border border-brand/40 px-1.5 py-0.5 align-middle font-mono text-[9px] uppercase text-brand"
        >system</span
      >
    </h1>
    <p class="mb-6 text-sm text-neutral-400">Your organization's details.</p>

    <p v-if="error || !account" class="text-sm text-neutral-500">Account not available.</p>

    <div v-else class="max-w-lg rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <!-- Admins edit inline; everyone else sees it read-only. -->
      <form v-if="canEdit" class="flex flex-col gap-3" @submit.prevent="save">
        <label class="field">Name<input v-model="form.name" class="inp" required /></label>
        <label class="field">
          Slug
          <input v-model="form.slug" class="inp" placeholder="lowercase-dashes" />
        </label>
        <div class="field">
          Bring your own AI
          <div class="inp bg-neutral-800/40 text-neutral-400">
            {{ account.bringYourOwnAi ? 'ON' : 'OFF' }}
            <span class="text-xs text-neutral-500">· set by a platform admin</span>
          </div>
        </div>
        <div class="field">
          Users
          <div class="inp bg-neutral-800/40 text-neutral-400">{{ account.userCount }}</div>
        </div>
        <p v-if="formError" class="m-0 text-sm text-red-400">{{ formError }}</p>
        <p v-else-if="saved" class="m-0 text-sm text-brand">Saved.</p>
        <div class="mt-1 flex justify-end">
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </form>

      <DetailList v-else :items="readOnlyDetails" />
    </div>

    <!-- Users in this account — super-admin management (list / view / edit / delete / move) -->
    <div v-if="account && isSuperAdmin" class="mt-10">
      <div class="kicker">// users</div>
      <h2 class="m-0 mb-3 text-lg font-bold tracking-tight text-white">Users</h2>
      <UsersManager :account-id="account.id" />
    </div>
  </div>
</template>
