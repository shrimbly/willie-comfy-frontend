/**
 * Behavioural coverage of MoshpitFolderPickerPopover.
 *
 * Strategy: Reka popovers stubbed for happy-dom. Seed foldersStore with two
 * folders; seed curationStore to test "all-in" state. Verify click → verb wiring.
 */
import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

const { addToFolderManySpy, removeFromFolderManySpy } = vi.hoisted(() => ({
  addToFolderManySpy: vi.fn(),
  removeFromFolderManySpy: vi.fn()
}))

vi.mock('@/platform/moshpit/composables/useMoshpitCuration', () => ({
  useMoshpitCuration: () => ({
    tagMany: vi.fn(),
    untagMany: vi.fn(),
    favouriteMany: vi.fn(),
    hideMany: vi.fn(),
    unhideMany: vi.fn(),
    addToFolderMany: addToFolderManySpy,
    removeFromFolderMany: removeFromFolderManySpy,
    exportMany: vi.fn(),
    undoLast: vi.fn(),
    lastUndoable: { value: null }
  })
}))

import MoshpitFolderPickerPopover from './MoshpitFolderPickerPopover.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      moshpit: {
        curation: {
          folders: {
            title: 'Folders',
            empty: 'No folders yet',
            newFolder: 'New folder\u2026',
            newFromSelection: 'New folder from selection',
            newFolderPlaceholder: 'Folder name',
            inputLabel: 'Folder name input',
            memberCount: '{count} assets',
            defaultName: 'Shortlist {date}',
            sectionLabel: 'Folders list',
            confirmDelete: 'Delete folder "{name}"? Assets remain in place.',
            rename: 'Rename',
            delete: 'Delete'
          },
          invalidFolder: 'Folder name must be 1\u201364 characters',
          folderCreated: 'Created folder "{name}" with {count} assets'
        }
      }
    }
  }
})

const PopoverRootStub = {
  name: 'PopoverRoot',
  props: ['open'],
  emits: ['update:open'],
  template: '<div><slot /></div>'
}
const PopoverPortalStub = {
  name: 'PopoverPortal',
  template: '<div><slot /></div>'
}
const PopoverContentStub = {
  name: 'PopoverContent',
  template: '<div><slot /></div>'
}
const PopoverAnchorStub = {
  name: 'PopoverAnchor',
  template: '<div><slot /></div>'
}

async function renderPopover(
  props: { open: boolean; hashes: readonly string[] } = {
    open: true,
    hashes: ['h1', 'h2']
  }
) {
  const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
  const { useMoshpitFoldersStore } =
    await import('@/platform/moshpit/stores/moshpitFoldersStore')
  const { useMoshpitCurationStore } =
    await import('@/platform/moshpit/stores/moshpitCurationStore')
  const foldersStore = useMoshpitFoldersStore(pinia)
  const curationStore = useMoshpitCurationStore(pinia)

  // Seed two folders
  const idA = foldersStore.create('Alpha')
  const idB = foldersStore.create('Beta')

  // h1 is in folder A (but not h2 → not "all in")
  curationStore.curationByHash.set('h1', {
    favourite: false,
    tags: [],
    folders: [idA],
    hidden: false
  })
  curationStore.curationByHash.set('h2', {
    favourite: false,
    tags: [],
    folders: [],
    hidden: false
  })

  const result = render(MoshpitFolderPickerPopover, {
    props,
    global: {
      plugins: [pinia, i18n],
      stubs: {
        PopoverRoot: PopoverRootStub,
        PopoverPortal: PopoverPortalStub,
        PopoverContent: PopoverContentStub,
        PopoverAnchor: PopoverAnchorStub,
        teleport: true
      }
    }
  })
  return { result, idA, idB, foldersStore, curationStore }
}

describe('MoshpitFolderPickerPopover — folder list', () => {
  beforeEach(() => {
    addToFolderManySpy.mockClear()
    removeFromFolderManySpy.mockClear()
  })

  it('renders rows for each folder in orderedFolders', async () => {
    await renderPopover()
    expect(screen.getByTestId('moshpit-folder-picker-row-Alpha')).not.toBeNull()
    expect(screen.getByTestId('moshpit-folder-picker-row-Beta')).not.toBeNull()
  })

  it('clicking a folder row calls addToFolderMany', async () => {
    const user = userEvent.setup()
    const { idA } = await renderPopover()
    await user.click(screen.getByTestId('moshpit-folder-picker-row-Alpha'))
    expect(addToFolderManySpy).toHaveBeenCalledWith(['h1', 'h2'], idA)
  })

  it('shows checked state for folder where all selected assets are members', async () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    const { useMoshpitFoldersStore } =
      await import('@/platform/moshpit/stores/moshpitFoldersStore')
    const { useMoshpitCurationStore } =
      await import('@/platform/moshpit/stores/moshpitCurationStore')
    const foldersStore = useMoshpitFoldersStore(pinia)
    const curationStore = useMoshpitCurationStore(pinia)

    const idA = foldersStore.create('Alpha')

    // Both hashes in folder A → allIn=true
    curationStore.curationByHash.set('h1', {
      favourite: false,
      tags: [],
      folders: [idA],
      hidden: false
    })
    curationStore.curationByHash.set('h2', {
      favourite: false,
      tags: [],
      folders: [idA],
      hidden: false
    })

    render(MoshpitFolderPickerPopover, {
      props: { open: true, hashes: ['h1', 'h2'] },
      global: {
        plugins: [pinia, i18n],
        stubs: {
          PopoverRoot: PopoverRootStub,
          PopoverPortal: PopoverPortalStub,
          PopoverContent: PopoverContentStub,
          PopoverAnchor: PopoverAnchorStub,
          teleport: true
        }
      }
    })

    const row = screen.getByTestId('moshpit-folder-picker-row-Alpha')
    expect(row.getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking an all-in folder row calls removeFromFolderMany', async () => {
    const user = userEvent.setup()
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    const { useMoshpitFoldersStore } =
      await import('@/platform/moshpit/stores/moshpitFoldersStore')
    const { useMoshpitCurationStore } =
      await import('@/platform/moshpit/stores/moshpitCurationStore')
    const foldersStore = useMoshpitFoldersStore(pinia)
    const curationStore = useMoshpitCurationStore(pinia)

    const idA = foldersStore.create('Alpha')
    curationStore.curationByHash.set('h1', {
      favourite: false,
      tags: [],
      folders: [idA],
      hidden: false
    })
    curationStore.curationByHash.set('h2', {
      favourite: false,
      tags: [],
      folders: [idA],
      hidden: false
    })

    render(MoshpitFolderPickerPopover, {
      props: { open: true, hashes: ['h1', 'h2'] },
      global: {
        plugins: [pinia, i18n],
        stubs: {
          PopoverRoot: PopoverRootStub,
          PopoverPortal: PopoverPortalStub,
          PopoverContent: PopoverContentStub,
          PopoverAnchor: PopoverAnchorStub,
          teleport: true
        }
      }
    })

    await user.click(screen.getByTestId('moshpit-folder-picker-row-Alpha'))
    expect(removeFromFolderManySpy).toHaveBeenCalledWith(['h1', 'h2'], idA)
  })
})

describe('MoshpitFolderPickerPopover — new folder', () => {
  beforeEach(() => {
    addToFolderManySpy.mockClear()
    removeFromFolderManySpy.mockClear()
  })

  it('shows new folder button', async () => {
    await renderPopover()
    expect(screen.getByTestId('moshpit-folder-picker-new-btn')).not.toBeNull()
  })

  it('clicking new folder button shows an inline input', async () => {
    const user = userEvent.setup()
    await renderPopover()
    await user.click(screen.getByTestId('moshpit-folder-picker-new-btn'))
    expect(screen.getByTestId('moshpit-folder-picker-new-input')).not.toBeNull()
  })

  it('entering a name in the new folder input and pressing Enter calls create + addToFolderMany', async () => {
    const user = userEvent.setup()
    const { foldersStore } = await renderPopover()
    const createSpy = vi.spyOn(foldersStore, 'create')

    await user.click(screen.getByTestId('moshpit-folder-picker-new-btn'))
    const input = screen.getByTestId('moshpit-folder-picker-new-input')
    await user.type(input, 'My Shortlist')
    await user.keyboard('{Enter}')

    expect(createSpy).toHaveBeenCalledWith('My Shortlist')
    expect(addToFolderManySpy).toHaveBeenCalled()
  })
})

describe('MoshpitFolderPickerPopover — new folder from selection', () => {
  beforeEach(() => {
    addToFolderManySpy.mockClear()
    removeFromFolderManySpy.mockClear()
  })

  it('shows the "new folder from selection" option', async () => {
    await renderPopover()
    expect(
      screen.getByTestId('moshpit-folder-picker-from-selection-btn')
    ).not.toBeNull()
  })

  it('clicking from-selection button shows a second inline input', async () => {
    const user = userEvent.setup()
    await renderPopover()
    await user.click(
      screen.getByTestId('moshpit-folder-picker-from-selection-btn')
    )
    expect(
      screen.getByTestId('moshpit-folder-picker-from-selection-input')
    ).not.toBeNull()
  })

  it('entering a name and pressing Enter calls foldersStore.createFromSelection', async () => {
    const user = userEvent.setup()
    const { foldersStore } = await renderPopover()
    const createFromSelectionSpy = vi.spyOn(foldersStore, 'createFromSelection')

    await user.click(
      screen.getByTestId('moshpit-folder-picker-from-selection-btn')
    )
    const input = screen.getByTestId(
      'moshpit-folder-picker-from-selection-input'
    )
    await user.type(input, 'Winners')
    await user.keyboard('{Enter}')

    expect(createFromSelectionSpy).toHaveBeenCalledWith('Winners', ['h1', 'h2'])
  })
})

describe('MoshpitFolderPickerPopover — empty state', () => {
  beforeEach(() => {
    addToFolderManySpy.mockClear()
    removeFromFolderManySpy.mockClear()
  })

  it('shows empty state message when no folders exist', async () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })

    render(MoshpitFolderPickerPopover, {
      props: { open: true, hashes: ['h1'] },
      global: {
        plugins: [pinia, i18n],
        stubs: {
          PopoverRoot: PopoverRootStub,
          PopoverPortal: PopoverPortalStub,
          PopoverContent: PopoverContentStub,
          PopoverAnchor: PopoverAnchorStub,
          teleport: true
        }
      }
    })

    expect(screen.getByTestId('moshpit-folder-picker-empty')).not.toBeNull()
  })
})
