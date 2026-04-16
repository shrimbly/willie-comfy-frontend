<template>
  <div
    class="folder-card"
    @click="emit('click')"
    @dblclick="emit('doubleClick')"
  >
    <div class="folder-icon-container">
      <i class="pi pi-folder text-6xl" :class="iconColorClass" />
    </div>
    <div class="folder-info">
      <p class="folder-name" :title="folder.name">{{ folder.name }}</p>
      <p v-if="folder.itemCount !== undefined" class="folder-count">
        {{
          $t(
            'assets.folders.itemCount',
            { count: folder.itemCount },
            folder.itemCount
          )
        }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FolderItem } from '@/utils/directoryPickerUtil'

interface Props {
  folder: FolderItem
  selected?: boolean
}

interface Emits {
  (e: 'click'): void
  (e: 'doubleClick'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const iconColorClass = computed(() => {
  return props.selected ? 'text-primary-500' : 'text-primary-400'
})
</script>

<style scoped>
.folder-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  border-radius: var(--p-border-radius);
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-border);
  cursor: pointer;
  transition: all 0.2s ease;
  height: 100%;
  min-height: 160px;
}

.folder-card:hover {
  background: var(--p-surface-50);
  border-color: var(--p-primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.1);
}

.folder-icon-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.folder-info {
  width: 100%;
  text-align: center;
}

.folder-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-text-color);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.folder-count {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin: 0.25rem 0 0;
}

/* Selected state */
.folder-card[aria-selected='true'] {
  border-color: var(--p-primary-color);
  background: var(--p-primary-50);
}
</style>
