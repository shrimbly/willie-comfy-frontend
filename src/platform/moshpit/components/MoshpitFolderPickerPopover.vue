<template>
  <PopoverRoot v-model:open="openModel">
    <PopoverAnchor as-child>
      <div aria-hidden="true" class="pointer-events-none" />
    </PopoverAnchor>
    <PopoverPortal>
      <PopoverContent
        class="z-50 w-64 rounded-lg border border-border-subtle bg-base-background p-2 shadow-interface"
        :side-offset="8"
        @escape-key-down="openModel = false"
      >
        <!-- Header -->
        <div
          class="mb-1 px-1 pb-1 text-2xs tracking-wide text-muted-foreground uppercase"
        >
          {{ t('moshpit.curation.folders.title') }}
        </div>

        <!-- Folder list -->
        <ul
          v-if="foldersStore.orderedFolders.length > 0"
          class="flex flex-col gap-0.5"
        >
          <li v-for="folder in foldersStore.orderedFolders" :key="folder.id">
            <button
              type="button"
              :aria-pressed="isAllIn(folder.id) ? 'true' : 'false'"
              :class="
                cn(
                  'flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm px-2 text-xs',
                  isAllIn(folder.id)
                    ? 'bg-interface-menu-component-surface-selected text-base-foreground'
                    : 'text-base-foreground hover:bg-secondary-background-hover'
                )
              "
              :data-testid="`moshpit-folder-picker-row-${folder.name}`"
              @click="onFolderClick(folder.id)"
            >
              <i
                v-if="isAllIn(folder.id)"
                class="icon-[lucide--check] size-3 shrink-0"
                aria-hidden="true"
              />
              <span class="truncate">{{ folder.name }}</span>
              <span class="ml-auto text-xs text-muted-foreground">
                {{ memberCount(folder.id) }}
              </span>
            </button>
          </li>
        </ul>
        <p
          v-else
          class="px-2 py-1 text-xs text-muted-foreground"
          data-testid="moshpit-folder-picker-empty"
        >
          {{ t('moshpit.curation.folders.empty') }}
        </p>

        <div class="my-1 border-t border-border-subtle" />

        <!-- New folder -->
        <template v-if="!creatingNew">
          <button
            type="button"
            class="flex h-8 w-full cursor-pointer items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground"
            data-testid="moshpit-folder-picker-new-btn"
            @click="creatingNew = true"
          >
            <i class="icon-[lucide--plus] size-3" aria-hidden="true" />
            {{ t('moshpit.curation.folders.newFolder') }}
          </button>
        </template>
        <template v-else>
          <input
            v-model="newFolderName"
            type="text"
            :placeholder="t('moshpit.curation.folders.newFolderPlaceholder')"
            :aria-label="t('moshpit.curation.folders.inputLabel')"
            maxlength="64"
            data-testid="moshpit-folder-picker-new-input"
            :class="newInputClasses"
            @keydown.enter="onCreateNew"
            @keydown.esc="cancelNew"
            @blur="cancelNew"
          />
        </template>

        <!-- New folder from selection -->
        <template v-if="!creatingFromSelection">
          <button
            type="button"
            class="flex h-8 w-full cursor-pointer items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground"
            data-testid="moshpit-folder-picker-from-selection-btn"
            @click="creatingFromSelection = true"
          >
            <i class="icon-[lucide--folder-plus] size-3" aria-hidden="true" />
            {{ t('moshpit.curation.folders.newFromSelection') }}
          </button>
        </template>
        <template v-else>
          <input
            v-model="fromSelectionName"
            type="text"
            :placeholder="t('moshpit.curation.folders.newFolderPlaceholder')"
            :aria-label="t('moshpit.curation.folders.inputLabel')"
            maxlength="64"
            data-testid="moshpit-folder-picker-from-selection-input"
            :class="newInputClasses"
            @keydown.enter="onCreateFromSelection"
            @keydown.esc="cancelFromSelection"
            @blur="cancelFromSelection"
          />
        </template>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import {
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot
} from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMoshpitCuration } from '@/platform/moshpit/composables/useMoshpitCuration'
import { useMoshpitCurationStore } from '@/platform/moshpit/stores/moshpitCurationStore'
import { useMoshpitFoldersStore } from '@/platform/moshpit/stores/moshpitFoldersStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ name: 'MoshpitFolderPickerPopover' })

const openModel = defineModel<boolean>('open', { required: true })
const { hashes } = defineProps<{ hashes: readonly string[] }>()

const { t } = useI18n()
const curation = useMoshpitCuration()
const curationStore = useMoshpitCurationStore()
const foldersStore = useMoshpitFoldersStore()
const toastStore = useToastStore()

const creatingNew = ref(false)
const newFolderName = ref('')
const creatingFromSelection = ref(false)
const fromSelectionName = ref('')

function isAllIn(folderId: string): boolean {
  if (hashes.length === 0) return false
  return hashes.every((h) => curationStore.get(h)?.folders.includes(folderId))
}

function memberCount(folderId: string): number {
  let n = 0
  for (const cur of curationStore.curationByHash.values()) {
    if (cur.folders.includes(folderId)) n++
  }
  return n
}

function onFolderClick(folderId: string): void {
  if (isAllIn(folderId)) {
    curation.removeFromFolderMany(hashes, folderId)
  } else {
    curation.addToFolderMany(hashes, folderId)
  }
}

function onCreateNew(): void {
  const trimmed = newFolderName.value.trim()
  if (!trimmed || trimmed.length > 64) {
    toastStore.add({
      severity: 'warn',
      summary: t('moshpit.curation.invalidFolder'),
      life: 3000
    })
    return
  }
  const id = foldersStore.create(trimmed)
  if (id) {
    curation.addToFolderMany(hashes, id)
  }
  newFolderName.value = ''
  creatingNew.value = false
}

function cancelNew(): void {
  newFolderName.value = ''
  creatingNew.value = false
}

function onCreateFromSelection(): void {
  const trimmed = fromSelectionName.value.trim()
  if (!trimmed || trimmed.length > 64) {
    toastStore.add({
      severity: 'warn',
      summary: t('moshpit.curation.invalidFolder'),
      life: 3000
    })
    return
  }
  foldersStore.createFromSelection(trimmed, hashes)
  toastStore.add({
    severity: 'info',
    summary: t('moshpit.curation.folderCreated', {
      name: trimmed,
      count: hashes.length
    }),
    life: 4000
  })
  fromSelectionName.value = ''
  creatingFromSelection.value = false
  openModel.value = false
}

function cancelFromSelection(): void {
  fromSelectionName.value = ''
  creatingFromSelection.value = false
}

const newInputClasses = cn(
  'w-full rounded-md border border-border-subtle bg-secondary-background px-2 py-1.5 text-xs',
  'outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)'
)
</script>
