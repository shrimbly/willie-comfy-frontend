<template>
  <div>
    <button
      :class="[
        'flex w-full cursor-pointer items-center gap-1 rounded-sm border-none px-2 py-1 text-left text-sm transition-colors',
        isSelected
          ? 'bg-primary/15 text-primary'
          : 'bg-transparent text-base-foreground hover:bg-secondary-background-hover'
      ]"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      @click="handleSelect"
    >
      <i
        :class="[
          'size-3.5 shrink-0 transition-transform',
          node.children.length > 0
            ? expanded
              ? 'icon-[lucide--chevron-down]'
              : 'icon-[lucide--chevron-right]'
            : 'invisible'
        ]"
        @click.stop="toggleExpand"
      />
      <i class="icon-[lucide--folder] size-4 shrink-0" />
      <span class="truncate">{{ node.name }}</span>
    </button>
    <div v-if="expanded && node.children.length > 0">
      <FolderTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :selected-path="selectedPath"
        :depth="depth + 1"
        @select="(path: string) => emit('select', path)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

export interface FolderTreeNodeType {
  name: string
  path: string
  children: FolderTreeNodeType[]
}

const props = defineProps<{
  node: FolderTreeNodeType
  selectedPath: string
  depth: number
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

const expanded = ref(props.depth === 0)

const isSelected = computed(() => props.selectedPath === props.node.path)

const handleSelect = () => {
  emit('select', props.node.path)
  if (props.node.children.length > 0) {
    expanded.value = true
  }
}

const toggleExpand = () => {
  expanded.value = !expanded.value
}
</script>
