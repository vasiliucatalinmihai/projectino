<script setup lang="ts">
// Self-service AI models for the caller's own account. The grid, form and
// effective-model banner live in <AiModelsManager>, which is also reused on the
// system-admin account-detail page (scoped to a specific account).
</script>

<template>
  <div>
    <div class="mb-4 min-w-0">
      <div class="kicker">// ai models</div>
      <h1 class="m-0 break-words text-2xl font-bold tracking-tight text-white">AI Models</h1>
    </div>

    <AiModelsManager />
  </div>
</template>
