<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <button
        type="button"
        :class="
          cn(
            'inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground',
            'hover:bg-secondary-background hover:text-base-foreground'
          )
        "
        data-testid="moshpit-add-filter-trigger"
      >
        <i class="icon-[lucide--plus] size-3" aria-hidden="true" />
        <span>{{ t('moshpit.filters.addFilter') }}</span>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        :side-offset="4"
        :class="
          cn(
            'z-1700 w-50 rounded-md border border-border-subtle bg-base-background p-1 shadow-sm',
            'data-[state=open]:data-[side=bottom]:animate-slideUpAndFade'
          )
        "
      >
        <!-- Step 1: Param picker -->
        <div v-if="step === 'param'" class="flex flex-col gap-0.5">
          <input
            v-model="paramSearch"
            type="text"
            :placeholder="t('moshpit.filters.searchParams')"
            class="mb-1 h-7 w-full rounded-sm border-b border-border-subtle bg-transparent px-2 text-xs outline-none"
          />
          <div v-if="primaryEntries.length > 0" class="flex flex-col gap-0.5">
            <span
              class="px-2 text-2xs tracking-wide text-muted-foreground uppercase"
              data-testid="moshpit-add-filter-primary-header"
            >
              {{ t('moshpit.filters.primaryLabel') }}
            </span>
            <ul class="max-h-[140px] overflow-y-auto">
              <li
                v-for="entry in primaryEntries"
                :key="entry.key"
                role="option"
                :aria-disabled="isParamActive(entry.key) ? 'true' : 'false'"
                :class="
                  cn(
                    'flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-xs',
                    isParamActive(entry.key)
                      ? 'pointer-events-none opacity-50'
                      : 'hover:bg-secondary-background-hover'
                  )
                "
                @click="selectParam(entry)"
              >
                <i
                  :class="cn(iconFor(entry.kind), 'size-3 shrink-0')"
                  aria-hidden="true"
                />
                <span>{{ entry.label }}</span>
              </li>
            </ul>
          </div>
          <div
            v-if="advancedEntries.length > 0"
            class="mt-1 flex flex-col gap-0.5"
          >
            <span
              class="px-2 text-2xs tracking-wide text-muted-foreground uppercase"
              data-testid="moshpit-add-filter-advanced-header"
            >
              {{ t('moshpit.filters.advancedLabel') }}
            </span>
            <ul class="max-h-[140px] overflow-y-auto">
              <li
                v-for="entry in advancedEntries"
                :key="entry.key"
                role="option"
                :aria-disabled="isParamActive(entry.key) ? 'true' : 'false'"
                :class="
                  cn(
                    'flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-xs',
                    isParamActive(entry.key)
                      ? 'pointer-events-none opacity-50'
                      : 'hover:bg-secondary-background-hover'
                  )
                "
                @click="selectParam(entry)"
              >
                <i
                  :class="cn(iconFor(entry.kind), 'size-3 shrink-0')"
                  aria-hidden="true"
                />
                <span>{{ entry.label }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Step 2: Value editor -->
        <div
          v-else-if="step === 'value' && draftEntry"
          class="flex flex-col gap-2 p-2"
        >
          <div class="flex items-center gap-2">
            <button
              type="button"
              :aria-label="t('moshpit.filters.editorBack')"
              class="text-muted-foreground hover:text-base-foreground"
              @click="backToStep1"
            >
              <i
                class="icon-[lucide--chevron-left] size-3"
                aria-hidden="true"
              />
            </button>
            <span class="text-xs font-medium">{{ draftEntry.label }}</span>
          </div>
          <component
            :is="editorFor(draftEntry.kind)"
            v-if="draftEntry"
            v-model="draftValue"
            :param="draftEntry.key"
            data-testid="moshpit-add-filter-editor"
          />
          <button
            type="button"
            :disabled="!canApply"
            :class="
              cn(
                'h-7 w-full rounded-sm bg-primary-background text-xs text-base-foreground',
                !canApply && 'cursor-not-allowed opacity-50'
              )
            "
            data-testid="moshpit-add-filter-apply"
            @click="onApply"
          >
            {{ t('moshpit.filters.editorApply') }}
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import Fuse from 'fuse.js'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'

import { cn } from '@/utils/tailwindUtil'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import type {
  ChipValue,
  ParamKey
} from '@/platform/moshpit/services/filterTypes'
import {
  ADVANCED_FILTER_PARAMS,
  PRIMARY_FILTER_PARAMS
} from '@/platform/moshpit/services/filterTypes'
import MoshpitNumericFilterEditor from './MoshpitNumericFilterEditor.vue'
import MoshpitCategoricalFilterEditor from './MoshpitCategoricalFilterEditor.vue'
import MoshpitTextFilterEditor from './MoshpitTextFilterEditor.vue'
import MoshpitResolutionFilterEditor from './MoshpitResolutionFilterEditor.vue'
import MoshpitBooleanFilterEditor from './MoshpitBooleanFilterEditor.vue'

defineOptions({ name: 'MoshpitAddFilterPopover' })

type ParamKind = 'numeric' | 'categorical' | 'text' | 'resolution' | 'boolean'

interface ParamEntry {
  readonly key: ParamKey
  readonly label: string
  readonly kind: ParamKind
  readonly icon: string
}

type EditorComponent =
  | typeof MoshpitNumericFilterEditor
  | typeof MoshpitCategoricalFilterEditor
  | typeof MoshpitTextFilterEditor
  | typeof MoshpitResolutionFilterEditor
  | typeof MoshpitBooleanFilterEditor

const { t } = useI18n()
const filterStore = useMoshpitFilterStore()

const isOpen = ref(false)
const step = ref<'param' | 'value'>('param')
const paramSearch = ref('')
const draftEntry = ref<ParamEntry | null>(null)
const draftValue = ref<ChipValue | null>(null)

const PARAM_ENTRIES: readonly ParamEntry[] = [
  {
    key: 'model',
    label: t('moshpit.filters.paramModel'),
    kind: 'categorical',
    icon: 'icon-[lucide--list]'
  },
  {
    key: 'loras',
    label: t('moshpit.filters.paramLoras'),
    kind: 'categorical',
    icon: 'icon-[lucide--list]'
  },
  {
    key: 'cfg',
    label: t('moshpit.filters.paramCfg'),
    kind: 'numeric',
    icon: 'icon-[lucide--hash]'
  },
  {
    key: 'steps',
    label: t('moshpit.filters.paramSteps'),
    kind: 'numeric',
    icon: 'icon-[lucide--hash]'
  },
  {
    key: 'sampler',
    label: t('moshpit.filters.paramSampler'),
    kind: 'categorical',
    icon: 'icon-[lucide--list]'
  },
  {
    key: 'scheduler',
    label: t('moshpit.filters.paramScheduler'),
    kind: 'categorical',
    icon: 'icon-[lucide--list]'
  },
  {
    key: 'seed',
    label: t('moshpit.filters.paramSeed'),
    kind: 'numeric',
    icon: 'icon-[lucide--hash]'
  },
  {
    key: 'positivePrompt',
    label: t('moshpit.filters.paramPrompt'),
    kind: 'text',
    icon: 'icon-[lucide--text]'
  },
  {
    key: 'negativePrompt',
    label: t('moshpit.filters.paramNegativePrompt'),
    kind: 'text',
    icon: 'icon-[lucide--text]'
  },
  {
    key: 'resolution',
    label: t('moshpit.filters.paramResolution'),
    kind: 'resolution',
    icon: 'icon-[lucide--maximize-2]'
  },
  {
    key: 'tags',
    label: t('moshpit.filters.paramTags'),
    kind: 'categorical',
    icon: 'icon-[lucide--list]'
  },
  {
    key: 'favourite',
    label: t('moshpit.filters.paramFavourite'),
    kind: 'boolean',
    icon: 'icon-[lucide--toggle-left]'
  },
  {
    key: 'saveNode',
    label: t('moshpit.filters.paramSaveNode'),
    kind: 'categorical',
    icon: 'icon-[lucide--list]'
  }
]

const fuse = new Fuse(PARAM_ENTRIES, { keys: ['label'], threshold: 0.4 })

const filteredParams = computed<readonly ParamEntry[]>(() => {
  if (!paramSearch.value) return PARAM_ENTRIES
  return fuse.search(paramSearch.value).map((r) => r.item)
})

const primaryEntries = computed<readonly ParamEntry[]>(() =>
  filteredParams.value.filter((e) => PRIMARY_FILTER_PARAMS.includes(e.key))
)

const advancedEntries = computed<readonly ParamEntry[]>(() =>
  filteredParams.value.filter((e) => ADVANCED_FILTER_PARAMS.includes(e.key))
)

const canApply = computed(() => draftValue.value !== null)

function isParamActive(key: ParamKey): boolean {
  return filterStore.chips.some((c) => c.param === key)
}

function iconFor(kind: ParamKind): string {
  switch (kind) {
    case 'numeric':
      return 'icon-[lucide--hash]'
    case 'categorical':
      return 'icon-[lucide--list]'
    case 'text':
      return 'icon-[lucide--text]'
    case 'boolean':
      return 'icon-[lucide--toggle-left]'
    case 'resolution':
      return 'icon-[lucide--maximize-2]'
  }
}

function editorFor(kind: ParamKind): EditorComponent {
  switch (kind) {
    case 'numeric':
      return MoshpitNumericFilterEditor
    case 'categorical':
      return MoshpitCategoricalFilterEditor
    case 'text':
      return MoshpitTextFilterEditor
    case 'resolution':
      return MoshpitResolutionFilterEditor
    case 'boolean':
      return MoshpitBooleanFilterEditor
  }
}

function selectParam(entry: ParamEntry): void {
  if (isParamActive(entry.key)) return
  draftEntry.value = entry
  draftValue.value = null
  step.value = 'value'
}

function backToStep1(): void {
  step.value = 'param'
  draftEntry.value = null
  draftValue.value = null
}

function onApply(): void {
  if (!draftEntry.value || !draftValue.value) return
  filterStore.addChip({
    id: crypto.randomUUID(),
    param: draftEntry.value.key,
    value: draftValue.value
  })
  isOpen.value = false
  step.value = 'param'
  draftEntry.value = null
  draftValue.value = null
  paramSearch.value = ''
}
</script>
