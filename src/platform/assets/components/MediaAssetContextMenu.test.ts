/* eslint-disable vue/one-component-per-file */
import { render } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, onMounted, ref } from 'vue'

import MediaAssetContextMenu from '@/platform/assets/components/MediaAssetContextMenu.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const mockData = vi.hoisted(() => ({
  isDesktop: false
}))

const mockElectronAPI = vi.hoisted(() => ({
  getPlatform: vi.fn(() => 'darwin'),
  openOutputsFolder: vi.fn(),
  openInputsFolder: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  }),
  createI18n: () => ({ install: () => {} })
}))

const mockFavorites = vi.hoisted(() => ({
  isFavorited: vi.fn(() => false),
  getFavoriteColor: vi.fn(() => null),
  setFavoriteColor: vi.fn(),
  toggleFavorite: vi.fn(),
  favoritedAssets: vi.fn(() => [])
}))

vi.mock('../composables/useAssetFavorites', () => ({
  FAVORITE_COLORS: ['yellow', 'blue', 'green'] as const,
  useAssetFavorites: () => mockFavorites
}))

vi.mock('@/platform/distribution/types', () => ({
  get isDesktop() {
    return mockData.isDesktop
  },
  isCloud: false
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => mockElectronAPI
}))

vi.mock('@/platform/workflow/utils/workflowExtractionUtil', () => ({
  supportsWorkflowMetadata: () => true
}))

vi.mock('@/utils/formatUtil', () => ({
  isPreviewableMediaType: () => true,
  getMediaTypeFromFilename: (name: string) => {
    if (/\.(mp4|webm|mov)$/i.test(name)) return 'video'
    if (/\.(mp3|wav|ogg|flac)$/i.test(name)) return 'audio'
    return 'image'
  }
}))

vi.mock('@/utils/loaderNodeUtil', () => ({
  detectNodeTypeFromFilename: () => ({ nodeType: 'LoadImage' })
}))

const mediaAssetActions = {
  addWorkflow: vi.fn(),
  downloadAsset: vi.fn(),
  openWorkflow: vi.fn(),
  exportWorkflow: vi.fn(),
  copyJobId: vi.fn(),
  deleteAssets: vi.fn().mockResolvedValue(false)
}

vi.mock('../composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => mediaAssetActions
}))

const contextMenuStub = defineComponent({
  name: 'ContextMenu',
  props: {
    model: {
      type: Array,
      default: () => []
    },
    pt: {
      type: Object,
      default: undefined
    }
  },
  emits: ['hide'],
  data() {
    return {
      visible: false
    }
  },
  methods: {
    show() {
      this.visible = true
    },
    hide() {
      this.visible = false
      this.$emit('hide')
    }
  },
  template: `
    <div
      v-if="visible"
      class="context-menu-stub"
      v-bind="pt?.root"
    >
      <div
        v-for="(item, i) in model"
        :key="i"
        :data-label="typeof item.label === 'function' ? item.label() : item.label"
        :data-icon="item.icon"
        :data-disabled="item.disabled ? 'true' : undefined"
        class="menu-item"
        @click="!item.disabled && item.command && item.command()"
      />
    </div>
  `
})

const asset: AssetItem = {
  id: 'asset-1',
  name: 'image.png',
  tags: [],
  user_metadata: {}
}

const buttonStub = {
  template: '<div class="button-stub"><slot /></div>'
}

interface MediaAssetContextMenuExposed {
  show: (event: MouseEvent) => void
}

let capturedRef: MediaAssetContextMenuExposed | null = null

interface MountOptions {
  assetType?: string
  showDirectoryViewAction?: boolean
  selectedAssets?: AssetItem[]
  isBulkMode?: boolean
  anchor?: AssetItem
}

function mountComponent(options: MountOptions = {}) {
  const {
    assetType = 'output',
    showDirectoryViewAction = false,
    selectedAssets,
    isBulkMode = false,
    anchor = asset
  } = options
  const onHide = vi.fn()
  const onShowInDirectoryView = vi.fn()
  const onBulkCompare = vi.fn()
  const { container, unmount } = render(
    defineComponent({
      components: { MediaAssetContextMenu },
      setup() {
        const menuRef = ref<MediaAssetContextMenuExposed | null>(null)
        onMounted(() => {
          capturedRef = menuRef.value
        })
        return {
          menuRef,
          anchor,
          onHide,
          onShowInDirectoryView,
          onBulkCompare,
          assetType,
          showDirectoryViewAction,
          selectedAssets,
          isBulkMode
        }
      },
      template: `<MediaAssetContextMenu
        ref="menuRef"
        :asset="anchor"
        :asset-type="assetType"
        file-kind="image"
        :show-directory-view-action="showDirectoryViewAction"
        :selected-assets="selectedAssets"
        :is-bulk-mode="isBulkMode"
        @hide="onHide"
        @show-in-directory-view="onShowInDirectoryView"
        @bulk-compare="onBulkCompare"
      />`
    }),
    {
      global: {
        stubs: {
          ContextMenu: contextMenuStub,
          Button: buttonStub
        }
      }
    }
  )
  return {
    container,
    unmount,
    onHide,
    onShowInDirectoryView,
    onBulkCompare
  }
}

async function showMenu(container: Element): Promise<HTMLElement> {
  const event = new MouseEvent('contextmenu', { bubbles: true })
  capturedRef!.show(event)
  await nextTick()
  // eslint-disable-next-line testing-library/no-container
  return container.querySelector('.context-menu-stub') as HTMLElement
}

afterEach(() => {
  vi.clearAllMocks()
  capturedRef = null
  document.body.innerHTML = ''
  mockData.isDesktop = false
})

describe('MediaAssetContextMenu', () => {
  it('dismisses outside pointerdown using the rendered root id', async () => {
    const { container, unmount, onHide } = mountComponent()
    const outside = document.createElement('div')
    document.body.append(outside)

    const menu = await showMenu(container)
    const menuId = menu.id

    expect(menuId).not.toBe('')
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.getElementById(menuId)).toBe(menu)

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('.context-menu-stub')).toBeNull()
    expect(onHide).toHaveBeenCalledOnce()

    unmount()
  })

  describe('show in directory view', () => {
    it('is visible when showDirectoryViewAction prop is true', async () => {
      const { container, unmount } = mountComponent({
        showDirectoryViewAction: true
      })
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.showInDirectoryView"]'
      )
      expect(item).not.toBeNull()
      unmount()
    })

    it('is hidden when showDirectoryViewAction prop is false', async () => {
      const { container, unmount } = mountComponent({
        showDirectoryViewAction: false
      })
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.showInDirectoryView"]'
      )
      expect(item).toBeNull()
      unmount()
    })

    it('emits show-in-directory-view when clicked', async () => {
      const { container, unmount, onShowInDirectoryView } = mountComponent({
        showDirectoryViewAction: true
      })
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.showInDirectoryView"]'
      ) as HTMLElement
      item.click()
      await nextTick()
      expect(onShowInDirectoryView).toHaveBeenCalledOnce()
      unmount()
    })
  })

  describe('show in file manager', () => {
    it('is visible when isDesktop is true', async () => {
      mockData.isDesktop = true
      const { container, unmount } = mountComponent()
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.showInFinder"]'
      )
      expect(item).not.toBeNull()
      unmount()
    })

    it('is hidden when isDesktop is false', async () => {
      mockData.isDesktop = false
      const { container, unmount } = mountComponent()
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const finder = container.querySelector(
        '[data-label="mediaAsset.actions.showInFinder"]'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const explorer = container.querySelector(
        '[data-label="mediaAsset.actions.showInExplorer"]'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const fileManager = container.querySelector(
        '[data-label="mediaAsset.actions.showInFileManager"]'
      )
      expect(finder).toBeNull()
      expect(explorer).toBeNull()
      expect(fileManager).toBeNull()
      unmount()
    })

    it('shows "Show in Finder" on darwin', async () => {
      mockData.isDesktop = true
      mockElectronAPI.getPlatform.mockReturnValue('darwin')
      const { container, unmount } = mountComponent()
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.showInFinder"]'
      )
      expect(item).not.toBeNull()
      unmount()
    })

    it('shows "Show in Explorer" on win32', async () => {
      mockData.isDesktop = true
      mockElectronAPI.getPlatform.mockReturnValue('win32')
      const { container, unmount } = mountComponent()
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.showInExplorer"]'
      )
      expect(item).not.toBeNull()
      unmount()
    })

    it('shows "Show in file manager" on linux', async () => {
      mockData.isDesktop = true
      mockElectronAPI.getPlatform.mockReturnValue('linux')
      const { container, unmount } = mountComponent()
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.showInFileManager"]'
      )
      expect(item).not.toBeNull()
      unmount()
    })

    it('calls openOutputsFolder for output assets', async () => {
      mockData.isDesktop = true
      mockElectronAPI.getPlatform.mockReturnValue('darwin')
      const { container, unmount } = mountComponent({ assetType: 'output' })
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.showInFinder"]'
      ) as HTMLElement
      item.click()
      expect(mockElectronAPI.openOutputsFolder).toHaveBeenCalledOnce()
      expect(mockElectronAPI.openInputsFolder).not.toHaveBeenCalled()
      unmount()
    })

    it('calls openInputsFolder for input assets', async () => {
      mockData.isDesktop = true
      mockElectronAPI.getPlatform.mockReturnValue('darwin')
      const { container, unmount } = mountComponent({ assetType: 'input' })
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.showInFinder"]'
      ) as HTMLElement
      item.click()
      expect(mockElectronAPI.openInputsFolder).toHaveBeenCalledOnce()
      expect(mockElectronAPI.openOutputsFolder).not.toHaveBeenCalled()
      unmount()
    })
  })

  describe('bulk compare', () => {
    const anchor: AssetItem = {
      id: 'a',
      name: 'anchor.png',
      tags: [],
      user_metadata: {}
    }
    const otherImage: AssetItem = {
      id: 'b',
      name: 'other.jpg',
      tags: [],
      user_metadata: {}
    }
    const otherImage2: AssetItem = {
      id: 'c',
      name: 'another.png',
      tags: [],
      user_metadata: {}
    }
    const video: AssetItem = {
      id: 'd',
      name: 'clip.mp4',
      tags: [],
      user_metadata: {}
    }

    it('is hidden in individual mode (no selectedAssets)', async () => {
      const { container, unmount } = mountComponent()
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.compare.action"]'
      )
      expect(item).toBeNull()
      unmount()
    })

    it('appears enabled when anchor has a same-type companion', async () => {
      const { container, unmount } = mountComponent({
        anchor,
        selectedAssets: [anchor, otherImage],
        isBulkMode: true
      })
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.compare.action"]'
      ) as HTMLElement
      expect(item).not.toBeNull()
      expect(item.dataset.disabled).toBeUndefined()
      unmount()
    })

    it('is disabled when no same-type companion exists', async () => {
      const { container, unmount } = mountComponent({
        anchor,
        selectedAssets: [anchor, video],
        isBulkMode: true
      })
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.compare.action"]'
      ) as HTMLElement
      expect(item).not.toBeNull()
      expect(item.dataset.disabled).toBe('true')
      unmount()
    })

    it('emits bulk-compare with only same-type subset and total count', async () => {
      const { container, unmount, onBulkCompare } = mountComponent({
        anchor,
        selectedAssets: [anchor, otherImage, video, otherImage2],
        isBulkMode: true
      })
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.compare.action"]'
      ) as HTMLElement
      item.click()
      await nextTick()
      expect(onBulkCompare).toHaveBeenCalledTimes(1)
      const [subset, total] = onBulkCompare.mock.calls[0]
      expect(total).toBe(4)
      expect((subset as AssetItem[]).map((a) => a.id)).toEqual(['a', 'b', 'c'])
      unmount()
    })

    it('disabled item does not emit when clicked', async () => {
      const { container, unmount, onBulkCompare } = mountComponent({
        anchor,
        selectedAssets: [anchor, video],
        isBulkMode: true
      })
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.compare.action"]'
      ) as HTMLElement
      item.click()
      await nextTick()
      expect(onBulkCompare).not.toHaveBeenCalled()
      unmount()
    })
  })
})
