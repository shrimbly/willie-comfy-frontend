<!--
  Moshpit lightbox — full-screen detail view for one or more selected assets.

  Opened via Enter-with-selection or double-click on a sprite. Shows the
  current asset at full resolution on the left and a single-asset metadata
  panel on the right. When multiple hashes are open, ArrowLeft / ArrowRight
  navigate and prev/next buttons are rendered over the image.

  Mirrors MoshpitTournamentOverlay for focus-trap + Reka Dialog patterns.
-->
<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  VisuallyHidden
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMoshpitLightboxKeybindings } from '@/platform/moshpit/composables/useMoshpitLightboxKeybindings'
import { useMoshpitLightboxStore } from '@/platform/moshpit/stores/moshpitLightboxStore'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { cn } from '@/utils/tailwindUtil'

import MoshpitAssetMetadataPanel from './MoshpitAssetMetadataPanel.vue'
import MoshpitTournamentAssetFrame from './MoshpitTournamentAssetFrame.vue'

defineOptions({ name: 'MoshpitLightboxOverlay' })

const { resolveFullResUrl } = defineProps<{
  resolveFullResUrl: (hash: string) => string | null
}>()

const { t } = useI18n()
const lightbox = useMoshpitLightboxStore()
const metadataStore = useMoshpitMetadataStore()

useMoshpitLightboxKeybindings()

const currentParams = computed(() =>
  lightbox.currentHash
    ? (metadataStore.getParams(lightbox.currentHash) ?? null)
    : null
)

const currentFullResUrl = computed(() =>
  lightbox.currentHash ? resolveFullResUrl(lightbox.currentHash) : null
)

const navButtonClasses = cn(
  'pointer-events-auto inline-flex size-10 items-center justify-center rounded-full',
  'bg-black/40 text-white backdrop-blur-sm transition-colors',
  'hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)'
)

const openModel = computed({
  get: () => lightbox.isOpen,
  set: (v: boolean) => {
    if (!v) lightbox.close()
  }
})

function onEscape(): void {
  lightbox.close()
}
</script>

<template>
  <DialogRoot v-model:open="openModel">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-1800 bg-black/70 backdrop-blur-sm"
        data-testid="moshpit-lightbox-overlay-backdrop"
      />
      <DialogContent
        class="fixed inset-6 z-1900 flex flex-col overflow-hidden rounded-2xl bg-base-background shadow-2xl outline-none lg:inset-10"
        tabindex="-1"
        data-testid="moshpit-lightbox-overlay-content"
        @escape-key-down="onEscape"
      >
        <VisuallyHidden>
          <DialogTitle>{{ t('moshpit.lightbox.dialogTitle') }}</DialogTitle>
          <DialogDescription>
            {{ t('moshpit.lightbox.dialogDescription') }}
          </DialogDescription>
        </VisuallyHidden>

        <header
          class="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-3"
        >
          <span
            v-if="lightbox.hasMultiple"
            class="text-xs text-muted-foreground tabular-nums"
            data-testid="moshpit-lightbox-counter"
          >
            {{
              t('moshpit.lightbox.counter', {
                current: lightbox.index + 1,
                total: lightbox.hashes.length
              })
            }}
          </span>
          <span v-else aria-hidden="true" />
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-interface-panel-hover hover:text-base-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
            :aria-label="t('g.closeDialog')"
            data-testid="moshpit-lightbox-close"
            @click="onEscape"
          >
            <i class="icon-[lucide--x] size-4" aria-hidden="true" />
          </button>
        </header>

        <main class="flex flex-1 overflow-hidden">
          <div class="relative flex flex-1 items-center justify-center">
            <MoshpitTournamentAssetFrame
              v-if="lightbox.currentHash"
              :key="lightbox.currentHash"
              :hash="lightbox.currentHash"
              :full-res-url="currentFullResUrl"
            />

            <template v-if="lightbox.hasMultiple">
              <button
                type="button"
                :class="
                  cn(
                    navButtonClasses,
                    'absolute top-1/2 left-4 -translate-y-1/2'
                  )
                "
                :aria-label="t('moshpit.lightbox.prev')"
                data-testid="moshpit-lightbox-prev"
                @click="lightbox.prev"
              >
                <i
                  class="icon-[lucide--chevron-left] size-5"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                :class="
                  cn(
                    navButtonClasses,
                    'absolute top-1/2 right-4 -translate-y-1/2'
                  )
                "
                :aria-label="t('moshpit.lightbox.next')"
                data-testid="moshpit-lightbox-next"
                @click="lightbox.next"
              >
                <i
                  class="icon-[lucide--chevron-right] size-5"
                  aria-hidden="true"
                />
              </button>
            </template>
          </div>

          <MoshpitAssetMetadataPanel :params="currentParams" />
        </main>

        <footer
          class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border-subtle bg-modal-panel-background px-4 py-3 text-xs text-muted-foreground"
          data-testid="moshpit-lightbox-legend"
        >
          <template v-if="lightbox.hasMultiple">
            <span>{{ t('moshpit.lightbox.legend.prev') }}</span>
            <span>{{ t('moshpit.lightbox.legend.next') }}</span>
          </template>
          <span class="ml-auto">{{ t('moshpit.lightbox.legend.exit') }}</span>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
