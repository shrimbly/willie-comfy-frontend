<template>
  <section
    class="flex flex-col gap-1"
    :aria-label="t('moshpit.curation.folders.sectionLabel')"
  >
    <div class="flex items-center justify-between">
      <span class="text-2xs tracking-wide text-muted-foreground uppercase">
        {{ t('moshpit.curation.folders.title') }}
      </span>
    </div>

    <ul
      v-if="foldersStore.orderedFolders.length > 0"
      class="flex flex-col gap-0.5"
    >
      <li
        v-for="folder in foldersStore.orderedFolders"
        :key="folder.id"
        class="flex items-center gap-1"
      >
        <button
          type="button"
          :class="
            cn(
              'flex h-7 flex-1 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs text-base-foreground',
              'hover:bg-secondary-background-hover'
            )
          "
          :data-testid="`moshpit-folder-row-${folder.name}`"
          @click="onRowClick(folder.id)"
        >
          <span class="truncate">{{ folder.name }}</span>
          <span class="ml-auto text-xs text-muted-foreground">
            {{ memberCount(folder.id) }}
          </span>
        </button>

        <!-- Overflow menu -->
        <DropdownMenuRoot>
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground"
              :aria-label="`${t('moshpit.curation.folders.rename')} / ${t('moshpit.curation.folders.delete')}`"
            >
              <i class="icon-[lucide--ellipsis] size-3" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              class="z-1700 min-w-[120px] rounded-md border border-border-subtle bg-base-background p-1 shadow-lg"
              :side-offset="2"
            >
              <DropdownMenuItem
                class="flex h-7 cursor-pointer items-center rounded-sm px-2 text-xs text-base-foreground hover:bg-secondary-background-hover"
                :data-testid="`moshpit-folder-rename-${folder.name}`"
                @select="startRename(folder.id, folder.name)"
              >
                {{ t('moshpit.curation.folders.rename') }}
              </DropdownMenuItem>
              <DropdownMenuItem
                class="text-danger flex h-7 cursor-pointer items-center rounded-sm px-2 text-xs hover:bg-secondary-background-hover"
                :data-testid="`moshpit-folder-delete-${folder.name}`"
                @select="onDelete(folder.id, folder.name)"
              >
                {{ t('moshpit.curation.folders.delete') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </li>
    </ul>

    <p
      v-else
      class="p-1 text-xs text-muted-foreground"
      data-testid="moshpit-folders-empty"
    >
      {{ t('moshpit.curation.folders.empty') }}
    </p>

    <!-- Rename inline input -->
    <input
      v-if="renamingId !== null"
      v-model="renameValue"
      type="text"
      :aria-label="t('moshpit.curation.folders.inputLabel')"
      maxlength="64"
      :class="inputClasses"
      data-testid="moshpit-folder-rename-input"
      @keydown.enter="onRenameSubmit"
      @keydown.esc="cancelRename"
      @blur="cancelRename"
    />

    <!-- New folder button / input -->
    <button
      v-if="!creating"
      type="button"
      class="flex h-7 cursor-pointer items-center gap-1 rounded-sm px-1 text-xs text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground"
      data-testid="moshpit-folders-new"
      @click="creating = true"
    >
      <i class="icon-[lucide--plus] size-3" aria-hidden="true" />
      {{ t('moshpit.curation.folders.newFolder') }}
    </button>
    <input
      v-else
      v-model="newFolderName"
      type="text"
      :placeholder="t('moshpit.curation.folders.newFolderPlaceholder')"
      :aria-label="t('moshpit.curation.folders.inputLabel')"
      maxlength="64"
      data-testid="moshpit-folders-new-input"
      :class="inputClasses"
      @keydown.enter="onCreate"
      @keydown.esc="onCreateCancel"
      @blur="onCreateCancel"
    />
  </section>
</template>

<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMoshpitCurationStore } from '@/platform/moshpit/stores/moshpitCurationStore'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import { useMoshpitFoldersStore } from '@/platform/moshpit/stores/moshpitFoldersStore'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ name: 'MoshpitFoldersSection' })

const { t } = useI18n()
const foldersStore = useMoshpitFoldersStore()
const curationStore = useMoshpitCurationStore()
const filterStore = useMoshpitFilterStore()

const creating = ref(false)
const newFolderName = ref('')
const renamingId = ref<string | null>(null)
const renameValue = ref('')

function memberCount(folderId: string): number {
  let n = 0
  for (const cur of curationStore.curationByHash.values()) {
    if (cur.folders.includes(folderId)) n++
  }
  return n
}

function onRowClick(folderId: string): void {
  filterStore.addChip({
    id: crypto.randomUUID(),
    param: 'folder',
    value: { kind: 'categorical', values: [folderId] }
  })
}

function onCreate(): void {
  const trimmed = newFolderName.value.trim()
  if (!trimmed) return
  foldersStore.create(trimmed)
  newFolderName.value = ''
  creating.value = false
}

function onCreateCancel(): void {
  newFolderName.value = ''
  creating.value = false
}

function startRename(id: string, currentName: string): void {
  renamingId.value = id
  renameValue.value = currentName
}

function onRenameSubmit(): void {
  if (!renamingId.value) return
  const trimmed = renameValue.value.trim()
  if (trimmed) {
    foldersStore.rename(renamingId.value, trimmed)
  }
  renamingId.value = null
  renameValue.value = ''
}

function cancelRename(): void {
  renamingId.value = null
  renameValue.value = ''
}

function onDelete(id: string, name: string): void {
  if (!window.confirm(t('moshpit.curation.folders.confirmDelete', { name })))
    return
  foldersStore.remove(id)
}

const inputClasses = cn(
  'w-full rounded-md border border-border-subtle bg-secondary-background px-2 py-1 text-xs',
  'outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)'
)
</script>
