import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ResultItemImpl } from '@/stores/queueStore'

import MediaLightbox from './MediaLightbox.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        close: 'Close',
        gallery: 'Gallery',
        previous: 'Previous',
        next: 'Next'
      },
      mediaAsset: {
        compare: {
          pinSide: 'Pin to this side',
          vs: 'vs',
          mode: {
            'side-by-side': 'Side by side',
            wipe: 'Wipe',
            flip: 'Flip'
          }
        }
      }
    }
  }
})

type MockResultItem = Partial<ResultItemImpl> & {
  filename: string
  subfolder: string
  type: string
  nodeId: NodeId
  mediaType: string
  id?: string
  url?: string
  isImage?: boolean
  isVideo?: boolean
  isAudio?: boolean
}

describe('MediaLightbox', () => {
  const mockComfyImage = {
    name: 'ComfyImage',
    template: '<div class="mock-comfy-image" data-testid="comfy-image"></div>',
    props: ['src', 'contain', 'alt']
  }

  const mockResultVideo = {
    name: 'ResultVideo',
    template:
      '<div class="mock-result-video" data-testid="result-video"></div>',
    props: ['result']
  }

  const mockResultAudio = {
    name: 'ResultAudio',
    template:
      '<div class="mock-result-audio" data-testid="result-audio"></div>',
    props: ['result']
  }

  const mockGalleryItems: MockResultItem[] = [
    {
      filename: 'image1.jpg',
      subfolder: 'outputs',
      type: 'output',
      nodeId: '123' as NodeId,
      mediaType: 'images',
      isImage: true,
      isVideo: false,
      isAudio: false,
      url: 'image1.jpg',
      id: '1'
    },
    {
      filename: 'image2.jpg',
      subfolder: 'outputs',
      type: 'output',
      nodeId: '456' as NodeId,
      mediaType: 'images',
      isImage: true,
      isVideo: false,
      isAudio: false,
      url: 'image2.jpg',
      id: '2'
    },
    {
      filename: 'image3.jpg',
      subfolder: 'outputs',
      type: 'output',
      nodeId: '789' as NodeId,
      mediaType: 'images',
      isImage: true,
      isVideo: false,
      isAudio: false,
      url: 'image3.jpg',
      id: '3'
    }
  ]

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  const renderGallery = (props = {}) => {
    const onUpdateActiveIndex = vi.fn()
    const user = userEvent.setup()
    const { rerender, container } = render(MediaLightbox, {
      global: {
        plugins: [i18n],
        components: {
          ComfyImage: mockComfyImage,
          ResultVideo: mockResultVideo,
          ResultAudio: mockResultAudio
        },
        stubs: {
          teleport: true
        }
      },
      props: {
        allGalleryItems: mockGalleryItems as ResultItemImpl[],
        activeIndex: 0,
        'onUpdate:activeIndex': onUpdateActiveIndex,
        ...props
      },
      container: document.body.appendChild(document.createElement('div'))
    })
    return { user, onUpdateActiveIndex, rerender, container }
  }

  it('renders overlay with role="dialog" and aria-modal', async () => {
    renderGallery()
    await nextTick()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('shows navigation buttons when multiple items', async () => {
    renderGallery()
    await nextTick()

    expect(screen.getByLabelText('Previous')).toBeInTheDocument()
    expect(screen.getByLabelText('Next')).toBeInTheDocument()
  })

  it('hides navigation buttons for single item', async () => {
    renderGallery({
      allGalleryItems: [mockGalleryItems[0]] as ResultItemImpl[]
    })
    await nextTick()

    expect(screen.queryByLabelText('Previous')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Next')).not.toBeInTheDocument()
  })

  it('shows gallery when activeIndex changes from -1', async () => {
    const { rerender, container } = renderGallery({ activeIndex: -1 })

    /* eslint-disable testing-library/no-container, testing-library/no-node-access */
    expect(container.querySelector('[data-mask]')).not.toBeInTheDocument()
    /* eslint-enable testing-library/no-container, testing-library/no-node-access */

    await rerender({
      allGalleryItems: mockGalleryItems as ResultItemImpl[],
      activeIndex: 0
    })
    await nextTick()

    /* eslint-disable testing-library/no-container, testing-library/no-node-access */
    expect(container.querySelector('[data-mask]')).toBeInTheDocument()
    /* eslint-enable testing-library/no-container, testing-library/no-node-access */
  })

  it('emits update:activeIndex with -1 when close button clicked', async () => {
    const { user, onUpdateActiveIndex } = renderGallery()
    await nextTick()

    await user.click(screen.getByLabelText('Close'))
    await nextTick()

    expect(onUpdateActiveIndex).toHaveBeenCalledWith(-1)
  })

  /* eslint-disable testing-library/prefer-user-event -- keyDown on dialog element for navigation, not text input */
  describe('keyboard navigation', () => {
    it('navigates to next item on ArrowRight', async () => {
      const { onUpdateActiveIndex } = renderGallery({ activeIndex: 0 })
      await nextTick()

      await fireEvent.keyDown(screen.getByRole('dialog'), {
        key: 'ArrowRight'
      })
      await nextTick()

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(1)
    })

    it('navigates to previous item on ArrowLeft', async () => {
      const { onUpdateActiveIndex } = renderGallery({ activeIndex: 1 })
      await nextTick()

      await fireEvent.keyDown(screen.getByRole('dialog'), {
        key: 'ArrowLeft'
      })
      await nextTick()

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(0)
    })

    it('wraps to last item on ArrowLeft from first', async () => {
      const { onUpdateActiveIndex } = renderGallery({ activeIndex: 0 })
      await nextTick()

      await fireEvent.keyDown(screen.getByRole('dialog'), {
        key: 'ArrowLeft'
      })
      await nextTick()

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(2)
    })

    it('closes gallery on Escape', async () => {
      const { onUpdateActiveIndex } = renderGallery({ activeIndex: 0 })
      await nextTick()

      await fireEvent.keyDown(screen.getByRole('dialog'), {
        key: 'Escape'
      })
      await nextTick()

      expect(onUpdateActiveIndex).toHaveBeenCalledWith(-1)
    })
  })
  /* eslint-enable testing-library/prefer-user-event */

  describe('compare mode', () => {
    /* eslint-disable testing-library/prefer-user-event */
    const mockLightboxAssetView = {
      name: 'LightboxAssetView',
      template:
        '<div class="mock-asset-view" :data-filename="item?.filename"></div>',
      props: ['item']
    }

    const mockPinBadge = {
      name: 'PinBadge',
      template:
        '<button class="mock-pin-badge" :data-pinned="pinned" @click="$emit(\'click\')"></button>',
      props: ['pinned', 'label'],
      emits: ['click']
    }

    const makeItem = (id: string, filename: string): MockResultItem => ({
      filename,
      subfolder: 'outputs',
      type: 'output',
      nodeId: id as NodeId,
      mediaType: 'images',
      isImage: true,
      isVideo: false,
      isAudio: false,
      url: filename,
      id
    })

    const renderCompare = (items: MockResultItem[], props = {}) => {
      const onUpdateActiveIndex = vi.fn()
      const { container, rerender } = render(MediaLightbox, {
        global: {
          plugins: [i18n],
          stubs: {
            teleport: true,
            LightboxAssetView: mockLightboxAssetView,
            PinBadge: mockPinBadge,
            ComfyImage: mockComfyImage,
            ResultVideo: mockResultVideo,
            ResultAudio: mockResultAudio
          }
        },
        props: {
          allGalleryItems: [] as ResultItemImpl[],
          activeIndex: 0,
          compareItems: items as ResultItemImpl[],
          'onUpdate:activeIndex': onUpdateActiveIndex,
          ...props
        },
        container: document.body.appendChild(document.createElement('div'))
      })
      return { container, rerender, onUpdateActiveIndex }
    }

    const getAssetFilenames = (container: Element): string[] =>
      Array.from(
        // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
        container.querySelectorAll('[data-filename]')
      ).map((el) => el.getAttribute('data-filename') ?? '')

    it('renders both items in side-by-side layout by default', async () => {
      const { container } = renderCompare([
        makeItem('1', 'a.png'),
        makeItem('2', 'b.png')
      ])
      await nextTick()
      expect(getAssetFilenames(container)).toEqual(['a.png', 'b.png'])
    })

    it('cycles modes on "/" key', async () => {
      const { container } = renderCompare([
        makeItem('1', 'a.png'),
        makeItem('2', 'b.png')
      ])
      await nextTick()
      const dialog = screen.getByRole('dialog')

      // Side-by-side shows both via LightboxAssetView stub
      expect(getAssetFilenames(container).length).toBe(2)

      // / → wipe: renders both direct <img> tags, stub count drops to 0
      await fireEvent.keyDown(dialog, { key: '/' })
      await nextTick()
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const wipeImages = container.querySelectorAll(
        'img[src="a.png"], img[src="b.png"]'
      )
      expect(wipeImages.length).toBe(2)

      // / → flip (single pane, stub again)
      await fireEvent.keyDown(dialog, { key: '/' })
      await nextTick()
      expect(getAssetFilenames(container)).toEqual(['a.png'])
    })

    it('toggles flip with spacebar only (arrows navigate cursor)', async () => {
      const { container } = renderCompare([
        makeItem('1', 'a.png'),
        makeItem('2', 'b.png'),
        makeItem('3', 'c.png')
      ])
      await nextTick()
      const dialog = screen.getByRole('dialog')

      // Jump to flip mode (click the flip button)
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const flipButton = container.querySelector(
        '[aria-label="Flip"]'
      ) as HTMLElement
      flipButton.click()
      await nextTick()
      // Initial: pinned=0 (a), cursor=1 (b); flip shows pinned (a)
      expect(getAssetFilenames(container)).toEqual(['a.png'])

      // Spacebar toggles between pinned (a) and cursor (b)
      await fireEvent.keyDown(dialog, { key: ' ' })
      await nextTick()
      expect(getAssetFilenames(container)).toEqual(['b.png'])

      await fireEvent.keyDown(dialog, { key: ' ' })
      await nextTick()
      expect(getAssetFilenames(container)).toEqual(['a.png'])

      // ArrowRight advances cursor (from b to c); flip still on pinned (a)
      await fireEvent.keyDown(dialog, { key: 'ArrowRight' })
      await nextTick()
      expect(getAssetFilenames(container)).toEqual(['a.png'])

      // Now space flips to the new cursor (c)
      await fireEvent.keyDown(dialog, { key: ' ' })
      await nextTick()
      expect(getAssetFilenames(container)).toEqual(['c.png'])
    })

    it('advances cursor with arrow keys skipping the pinned item (3+ items)', async () => {
      const { container } = renderCompare([
        makeItem('1', 'a.png'),
        makeItem('2', 'b.png'),
        makeItem('3', 'c.png')
      ])
      await nextTick()
      const dialog = screen.getByRole('dialog')

      // Initial: pinned=0 (a), cursor=1 (b) → [a, b]
      expect(getAssetFilenames(container)).toEqual(['a.png', 'b.png'])

      await fireEvent.keyDown(dialog, { key: 'ArrowRight' })
      await nextTick()
      // Cursor advances 1 → 2 (skips pinned 0)
      expect(getAssetFilenames(container)).toEqual(['a.png', 'c.png'])

      await fireEvent.keyDown(dialog, { key: 'ArrowRight' })
      await nextTick()
      // Cursor wraps 2 → 0 (pinned), skips to 1
      expect(getAssetFilenames(container)).toEqual(['a.png', 'b.png'])
    })

    it('arrow keys are no-op with exactly 2 items', async () => {
      const { container } = renderCompare([
        makeItem('1', 'a.png'),
        makeItem('2', 'b.png')
      ])
      await nextTick()
      const dialog = screen.getByRole('dialog')

      await fireEvent.keyDown(dialog, { key: 'ArrowRight' })
      await nextTick()
      expect(getAssetFilenames(container)).toEqual(['a.png', 'b.png'])
    })

    it('pin-swap swaps left and right on PinBadge click', async () => {
      const { container } = renderCompare([
        makeItem('1', 'a.png'),
        makeItem('2', 'b.png'),
        makeItem('3', 'c.png')
      ])
      await nextTick()
      // Initial: [a, b] → left = pinned (a), right = cursor (b)
      expect(getAssetFilenames(container)).toEqual(['a.png', 'b.png'])

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const rightPin = container.querySelectorAll(
        '.mock-pin-badge'
      )[1] as HTMLElement
      rightPin.click()
      await nextTick()
      // Right pane now pinned (b), left is cursor which was previously pinned (a).
      // After swap: left=compareItems[cursorIndex=0]=a, right=compareItems[pinnedIndex=1]=b.
      // Visually [a,b] still — pin change affects navigation behavior.
      expect(getAssetFilenames(container)).toEqual(['a.png', 'b.png'])

      // Now ArrowRight advances the LEFT side (cursor) skipping index 1 (pinned)
      const dialog = screen.getByRole('dialog')
      await fireEvent.keyDown(dialog, { key: 'ArrowRight' })
      await nextTick()
      expect(getAssetFilenames(container)).toEqual(['c.png', 'b.png'])
    })
    /* eslint-enable testing-library/prefer-user-event */
  })
})
