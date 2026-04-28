import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { FolderTreeNodeType } from '@/platform/assets/components/FolderTreeNode.vue'
import OutputFoldersSidebar from '@/platform/assets/components/OutputFoldersSidebar.vue'
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
            allFoldersHeader: 'All folders',
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
  trees: FolderTreeNodeType[]
  selectedPath?: string
  pinnedPaths?: string[]
}) {
  return render(OutputFoldersSidebar, {
    props: {
      trees: props.trees,
      selectedPath: props.selectedPath ?? 'output',
      pinnedPaths: props.pinnedPaths ?? []
    },
    global: { plugins: [i18n] }
  })
}

describe('OutputFoldersSidebar', () => {
  it('shows hint when no folders are pinned', () => {
    renderSidebar({ trees: [makeOutputTree(['a/file.png'])] })
    expect(screen.getByText('Drag folders here to pin')).toBeInTheDocument()
  })

  it('hides hint when at least one folder is pinned', () => {
    renderSidebar({
      trees: [makeOutputTree(['a/file.png', 'b/file.png'])],
      pinnedPaths: ['output/a']
    })
    expect(
      screen.queryByText('Drag folders here to pin')
    ).not.toBeInTheDocument()
  })

  it('renders all top-level folders under "All folders"', () => {
    renderSidebar({
      trees: [makeOutputTree(['alpha/a.png', 'beta/b.png'])]
    })
    expect(screen.getAllByText('alpha')).toHaveLength(1)
    expect(screen.getAllByText('beta')).toHaveLength(1)
  })

  it('renders folders from multiple trees (output + input)', () => {
    renderSidebar({
      trees: [
        makeOutputTree(['alpha/a.png']),
        makeInputTree(['uploaded/b.png'])
      ]
    })
    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.getByText('uploaded')).toBeInTheDocument()
    expect(screen.getByText('output')).toBeInTheDocument()
    expect(screen.getByText('input')).toBeInTheDocument()
  })

  it('emits select with the absolute path when a folder is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSidebar({
      trees: [makeOutputTree(['alpha/a.png'])]
    })

    await user.click(screen.getByText('alpha'))

    const events = emitted().select as string[][] | undefined
    expect(events?.[0]).toEqual(['output/alpha'])
  })

  it('emits select with the root path when the root home button is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSidebar({
      trees: [makeOutputTree(['alpha/a.png'])]
    })

    await user.click(screen.getByText('output'))

    const events = emitted().select as string[][] | undefined
    expect(events?.[0]).toEqual(['output'])
  })

  it('emits update:pinnedPaths when a folder is dropped onto the pinned section', async () => {
    const { emitted } = renderSidebar({
      trees: [makeOutputTree(['alpha/a.png', 'beta/b.png'])]
    })

    const pinnedSection = screen.getByTestId('folders-sidebar-pinned')
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', 'output/alpha')

    await fireEvent.drop(pinnedSection, { dataTransfer })

    const events = emitted()['update:pinnedPaths'] as string[][][] | undefined
    expect(events?.[0]).toEqual([['output/alpha']])
  })

  it('does not re-pin an already-pinned folder', async () => {
    const { emitted } = renderSidebar({
      trees: [makeOutputTree(['alpha/a.png'])],
      pinnedPaths: ['output/alpha']
    })

    const pinnedSection = screen.getByTestId('folders-sidebar-pinned')
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', 'output/alpha')

    await fireEvent.drop(pinnedSection, { dataTransfer })

    expect(emitted()['update:pinnedPaths']).toBeUndefined()
  })

  it('does not pin the root itself', async () => {
    const { emitted } = renderSidebar({
      trees: [makeOutputTree(['alpha/a.png'])]
    })

    const pinnedSection = screen.getByTestId('folders-sidebar-pinned')
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', 'output')

    await fireEvent.drop(pinnedSection, { dataTransfer })

    expect(emitted()['update:pinnedPaths']).toBeUndefined()
  })

  it('removes a pinned folder when dropped into the all-folders section', async () => {
    const { emitted, container } = renderSidebar({
      trees: [makeOutputTree(['alpha/a.png', 'beta/b.png'])],
      pinnedPaths: ['output/alpha']
    })

    const pinnedSection = screen.getByTestId('folders-sidebar-pinned')
    const allFoldersSection = screen.getByTestId('folders-sidebar-all')
    // eslint-disable-next-line testing-library/no-node-access -- need the draggable button inside the pinned section
    const pinnedButton = pinnedSection.querySelector('button')!

    const dataTransfer = new DataTransfer()
    await fireEvent.dragStart(pinnedButton, { dataTransfer })
    dataTransfer.setData('text/plain', 'output/alpha')
    await fireEvent.drop(allFoldersSection, { dataTransfer })

    const events = emitted()['update:pinnedPaths'] as string[][][] | undefined
    expect(events?.[events.length - 1]).toEqual([[]])
    expect(container).toBeTruthy()
  })
})
