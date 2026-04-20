<template>
  <WorkspaceAuthGate>
    <main class="relative size-full overflow-hidden bg-node-component-surface">
      <MoshpitView />
    </main>
  </WorkspaceAuthGate>
</template>

<script setup lang="ts">
defineOptions({ name: 'MoshpitLayout' })

import WorkspaceAuthGate from '@/platform/workspace/auth/WorkspaceAuthGate.vue'
import MoshpitView from '@/views/MoshpitView.vue'
</script>
