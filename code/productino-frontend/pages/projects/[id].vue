<script setup lang="ts">
interface Project {
  id: number;
  name: string;
  accountId: number;
  clientId: number;
  clientName: string | null;
  briefing: string | null;
  stage: string;
}

const route = useRoute();
const projectId = Number(route.params.id);

const { data: project, error } = await useAsyncData<Project | null>(`project-${projectId}`, () =>
  useApi<Project>(`/projects/${projectId}`).catch(() => null),
);

const details = computed(() => [
  { label: 'ID', value: project.value?.id },
  { label: 'Client', value: project.value?.clientName },
  { label: 'Stage', value: project.value?.stage, mono: true },
  { label: 'Briefing', value: project.value?.briefing, pre: true },
]);
</script>

<template>
  <div>
    <NuxtLink to="/projects" class="text-sm text-neutral-400 hover:text-brand">← Projects</NuxtLink>

    <p v-if="error || !project" class="mt-4 text-sm text-neutral-500">Project not found.</p>

    <template v-else>
      <div class="mb-5 mt-2">
        <div class="kicker">// project</div>
        <h1 class="m-0 text-2xl font-bold tracking-tight text-white">{{ project.name }}</h1>
        <NuxtLink
          v-if="project.clientName"
          :to="`/clients/${project.clientId}`"
          class="text-sm text-neutral-400 hover:text-brand"
        >
          {{ project.clientName }} →
        </NuxtLink>
      </div>

      <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <DetailList :items="details" />
      </div>
    </template>
  </div>
</template>
