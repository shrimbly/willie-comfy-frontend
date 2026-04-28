/* eslint-disable vue/one-component-per-file */
import { render } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, onMounted, ref } from 'vue'

import FolderContextMenu from '@/platform/assets/components/FolderContextMenu.vue'

const mockData = vi.hoisted(() => ({
  isDesktop: false
}))

const mockElectronAPI = vi.hoisted(() => ({
  getPlatform: vi.fn(() => 'darwin')
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  get isDesktop() {
    return mockData.isDesktop
  }
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => mockElectronAPI
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
        class="menu-item"
        @click="item.command && item.command()"
      />
    </div>
  `
})

const buttonStub = {
  template: '<div class="button-stub"><slot /></div>'
}

interface FolderContextMenuExposed {
  show: (event: MouseEvent) => void
}

let capturedRef: FolderContextMenuExposed | null = null

interface MountOptions {
  allowMoveActions?: boolean
}

function mountComponent(options: MountOptions = {}) {
  const { allowMoveActions = false } = options
  const onHide = vi.fn()
  const onOpenInFinder = vi.fn()
  const onExportAll = vi.fn()
  const onMoveTo = vi.fn()
  const { container, unmount } = render(
    defineComponent({
      components: { FolderContextMenu },
      setup() {
        const menuRef = ref<FolderContextMenuExposed | null>(null)
        onMounted(() => {
          capturedRef = menuRef.value
        })
        return {
          menuRef,
          onHide,
          onOpenInFinder,
          onExportAll,
          onMoveTo,
          allowMoveActions
        }
      },
      template: `<FolderContextMenu
        ref="menuRef"
        :allow-move-actions="allowMoveActions"
        @hide="onHide"
        @open-in-finder="onOpenInFinder"
        @export-all="onExportAll"
        @move-to="onMoveTo"
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
  return { container, unmount, onHide, onOpenInFinder, onExportAll, onMoveTo }
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

describe('FolderContextMenu', () => {
  it('always shows export all item', async () => {
    const { container, unmount } = mountComponent()
    await showMenu(container)
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const item = container.querySelector(
      '[data-label="mediaAsset.actions.exportAll"]'
    )
    expect(item).not.toBeNull()
    unmount()
  })

  it('emits export-all when clicked', async () => {
    const { container, unmount, onExportAll } = mountComponent()
    await showMenu(container)
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const item = container.querySelector(
      '[data-label="mediaAsset.actions.exportAll"]'
    ) as HTMLElement
    item.click()
    await nextTick()
    expect(onExportAll).toHaveBeenCalledOnce()
    unmount()
  })

  describe('move to', () => {
    it('is visible when allowMoveActions is true', async () => {
      const { container, unmount } = mountComponent({ allowMoveActions: true })
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.moveFolderTo"]'
      )
      expect(item).not.toBeNull()
      unmount()
    })

    it('is hidden when allowMoveActions is false', async () => {
      const { container, unmount } = mountComponent({ allowMoveActions: false })
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.moveFolderTo"]'
      )
      expect(item).toBeNull()
      unmount()
    })

    it('emits move-to when clicked', async () => {
      const { container, unmount, onMoveTo } = mountComponent({
        allowMoveActions: true
      })
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.moveFolderTo"]'
      ) as HTMLElement
      item.click()
      await nextTick()
      expect(onMoveTo).toHaveBeenCalledOnce()
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

    it('emits open-in-finder when clicked', async () => {
      mockData.isDesktop = true
      mockElectronAPI.getPlatform.mockReturnValue('darwin')
      const { container, unmount, onOpenInFinder } = mountComponent()
      await showMenu(container)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const item = container.querySelector(
        '[data-label="mediaAsset.actions.showInFinder"]'
      ) as HTMLElement
      item.click()
      await nextTick()
      expect(onOpenInFinder).toHaveBeenCalledOnce()
      unmount()
    })
  })

  it('dismisses on outside pointerdown', async () => {
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
})
