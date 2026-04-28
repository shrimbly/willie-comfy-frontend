import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { FolderTreeNodeType } from '@/platform/assets/components/FolderTreeNode.vue'
import RecentsFoldersSidebar from '@/platform/assets/components/RecentsFoldersSidebar.vue'
import { buildOutputFolderTree } from '@/platform/assets/utils/buildOutputFolderTree'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      sideToolbar: {
        mediaAssets: {
          foldersSidebar: {
            pinnedHeader: 'Pinned',
            importedHeader: 'Imported',
            generatedHeader: 'Generated',
            recent: 'Recent',
            favorites: 'Favorites',
            favoriteColors: {
              yellow: 'Yellow',
              blue: 'Blue',
              green: 'Green'
            },
            pinHint: 'Drag folders here to pin'
          }
        }
      }
    }
  }
})

const OUTPUT_ROOT = { name: 'output', path: 'output' }
const INPUT_ROOT = { name: 'input', path: 'input' }

function makeOutputTree(filenames: string[]): FolderTreeNodeType {
  return buildOutputFolderTree(filenames, OUTPUT_ROOT)
}

function makeInputTree(filenames: string[]): FolderTreeNodeType {
  return buildOutputFolderTree(filenames, INPUT_ROOT)
}

function renderSidebar(props: {
  inputTree?: FolderTreeNodeType
  outputTree?: FolderTreeNodeType
  selectedPath?: string
  pinnedPaths?: string[]
  recentsActive?: boolean
  favoritesActive?: boolean
  favoriteColorFilter?: 'yellow' | 'blue' | 'green' | null
}) {
  return render(RecentsFoldersSidebar, {
    props: {
      inputTree: props.inputTree ?? makeInputTree([]),
      outputTree: props.outputTree ?? makeOutputTree([]),
      selectedPath: props.selectedPath ?? '',
      pinnedPaths: props.pinnedPaths ?? [],
      recentsActive: props.recentsActive ?? true,
      favoritesActive: props.favoritesActive ?? false,
      favoriteColorFilter: props.favoriteColorFilter ?? null
    },
    global: { plugins: [i18n] }
  })
}

describe('RecentsFoldersSidebar', () => {
  it('renders Recent, Favorites, Generated and Imported entries', () => {
    renderSidebar({})
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toBeInTheDocument()
    expect(screen.getByText('Generated')).toBeInTheDocument()
    expect(screen.getByText('Imported')).toBeInTheDocument()
  })

  it('emits selectFavorites when Favorites is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSidebar({})

    await user.click(screen.getByText('Favorites'))

    const events = emitted().selectFavorites as unknown[][] | undefined
    expect(events).toHaveLength(1)
  })

  it('does not show color sub-rows when favorites is inactive', () => {
    renderSidebar({ favoritesActive: false })
    expect(screen.queryByText('Yellow')).not.toBeInTheDocument()
    expect(screen.queryByText('Blue')).not.toBeInTheDocument()
    expect(screen.queryByText('Green')).not.toBeInTheDocument()
  })

  it('shows color sub-rows when favorites is active', () => {
    renderSidebar({ favoritesActive: true })
    expect(screen.getByText('Yellow')).toBeInTheDocument()
    expect(screen.getByText('Blue')).toBeInTheDocument()
    expect(screen.getByText('Green')).toBeInTheDocument()
  })

  it('emits selectFavoriteColor when a color sub-row is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSidebar({ favoritesActive: true })

    await user.click(screen.getByText('Blue'))

    const events = emitted().selectFavoriteColor as
      | (string | null)[][]
      | undefined
    expect(events?.[0]).toEqual(['blue'])
  })

  it('emits null when the active color is clicked again', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSidebar({
      favoritesActive: true,
      favoriteColorFilter: 'green'
    })

    await user.click(screen.getByText('Green'))

    const events = emitted().selectFavoriteColor as
      | (string | null)[][]
      | undefined
    expect(events?.[0]).toEqual([null])
  })

  it('emits selectRecents when Recent is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSidebar({ recentsActive: false })

    await user.click(screen.getByText('Recent'))

    const events = emitted().selectRecents as unknown[][] | undefined
    expect(events).toHaveLength(1)
  })

  it('emits select with output root when Generated is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSidebar({})

    await user.click(screen.getByText('Generated'))

    const events = emitted().select as string[][] | undefined
    expect(events?.[0]).toEqual(['output'])
  })

  it('emits select with input root when Imported is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSidebar({})

    await user.click(screen.getByText('Imported'))

    const events = emitted().select as string[][] | undefined
    expect(events?.[0]).toEqual(['input'])
  })

  it('renders output folders below Generated', () => {
    renderSidebar({ outputTree: makeOutputTree(['run1/a.png', 'run2/b.png']) })
    expect(screen.getByText('run1')).toBeInTheDocument()
    expect(screen.getByText('run2')).toBeInTheDocument()
  })

  it('renders input folders below Imported', () => {
    renderSidebar({ inputTree: makeInputTree(['alpha/a.png']) })
    expect(screen.getByText('alpha')).toBeInTheDocument()
  })

  it('shows pin hint when no folders are pinned', () => {
    renderSidebar({})
    expect(screen.getByText('Drag folders here to pin')).toBeInTheDocument()
  })

  it('emits update:pinnedPaths when a folder is dropped onto Pinned', async () => {
    const { emitted } = renderSidebar({
      inputTree: makeInputTree(['alpha/a.png'])
    })

    const pinnedSection = screen.getByTestId('recents-sidebar-pinned')
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', 'input/alpha')

    await fireEvent.drop(pinnedSection, { dataTransfer })

    const events = emitted()['update:pinnedPaths'] as string[][][] | undefined
    expect(events?.[0]).toEqual([['input/alpha']])
  })

  it('does not pin a tree root itself', async () => {
    const { emitted } = renderSidebar({
      inputTree: makeInputTree(['alpha/a.png'])
    })

    const pinnedSection = screen.getByTestId('recents-sidebar-pinned')
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', 'input')

    await fireEvent.drop(pinnedSection, { dataTransfer })

    expect(emitted()['update:pinnedPaths']).toBeUndefined()
  })

  it('emits select with folder path when a subfolder is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSidebar({
      inputTree: makeInputTree(['alpha/a.png'])
    })

    await user.click(screen.getByText('alpha'))

    const events = emitted().select as string[][] | undefined
    // The output tree root 'output' may also emit when clicked, but we click a subfolder
    expect(events?.[events.length - 1]).toEqual(['input/alpha'])
  })
})
