<script setup lang="ts">
interface ViewUser {
  id: number;
  email: string;
  name: string | null;
  account?: { id: number; name: string; isSystem: boolean } | null;
  permissions: string[];
  isSuperAdmin: boolean;
  active: boolean;
  activationToken: string | null;
  createdAt?: string;
}

const props = defineProps<{
  user: ViewUser;
  canManage: boolean;
  /** Disables the Change-password / Edit / Delete buttons for the viewer themselves. */
  isSelf?: boolean;
}>();
const emit = defineEmits<{
  edit: [];
  remove: [];
  resetPassword: [];
  close: [];
}>();

const copied = ref(false);
const copyFailed = ref(false);
const activationUrl = computed(() => {
  if (!props.user.activationToken) return '';
  if (typeof window === 'undefined') return `/activate/${props.user.activationToken}`;
  return `${window.location.origin}/activate/${props.user.activationToken}`;
});

/** Copy silently. Uses the async Clipboard API on secure contexts and falls
 *  back to a hidden textarea + execCommand on plain http (e.g. dev.production.io). */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

async function copyLink() {
  if (!activationUrl.value) return;
  const ok = await writeToClipboard(activationUrl.value);
  if (ok) {
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } else {
    copyFailed.value = true;
    setTimeout(() => (copyFailed.value = false), 2500);
  }
}
</script>

<template>
  <Modal :title="user.email" @close="emit('close')">
    <dl class="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
      <dt class="text-xs text-neutral-500">Name</dt>
      <dd class="m-0 text-sm text-neutral-200">{{ user.name ?? '—' }}</dd>
      <dt class="text-xs text-neutral-500">Account</dt>
      <dd class="m-0 text-sm text-neutral-200">{{ user.account?.name ?? '—' }}</dd>
      <dt class="text-xs text-neutral-500">Permissions</dt>
      <dd class="m-0 font-mono text-xs text-brand">{{ user.permissions.join(' · ') || '—' }}</dd>
      <dt class="text-xs text-neutral-500">Active</dt>
      <dd class="m-0 text-sm" :class="user.active ? 'text-brand' : 'text-amber-300'">
        {{ user.active ? 'yes' : 'no' }}
      </dd>
    </dl>

    <!-- Activation hash + copy link (only when admin can manage and a token exists) -->
    <div
      v-if="canManage && user.activationToken"
      class="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
    >
      <div class="mb-1 flex items-center justify-between">
        <span class="font-mono text-[10px] uppercase tracking-wider text-amber-300">
          // pending activation
        </span>
        <button
          class="rounded border border-amber-400/50 px-2 py-0.5 font-mono text-xs text-amber-200 hover:bg-amber-500/20"
          @click="copyLink"
        >
          {{ copied ? 'copied ✓' : copyFailed ? "couldn't copy" : 'copy link' }}
        </button>
      </div>
      <div class="break-all font-mono text-[11px] text-amber-200/90">{{ user.activationToken }}</div>
      <p class="mt-2 text-xs text-amber-200/70">
        Share the activation link so the user can set their password. The link works once.
      </p>
    </div>

    <!-- Action footer -->
    <div class="mt-5 flex flex-wrap justify-end gap-2">
      <button v-if="canManage && !isSelf" class="btn-danger" @click="emit('remove')">Delete</button>
      <button
        v-if="canManage && !isSelf"
        class="btn-ghost"
        @click="emit('resetPassword')"
      >
        Change password
      </button>
      <button v-if="canManage" class="btn-primary" @click="emit('edit')">Edit</button>
    </div>
  </Modal>
</template>
