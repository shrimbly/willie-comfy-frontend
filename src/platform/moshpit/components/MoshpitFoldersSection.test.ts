/**
 * Behavioural coverage of MoshpitFoldersSection.
 *
 * Tests cover: folder row rendering + member counts, row click → addChip,
 * new folder inline input → create, delete with window.confirm guard,
 * empty state rendering.
 */
import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import MoshpitFoldersSection from './MoshpitFoldersSection.vue'

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
            sectionLabel: 'Folders list',
            confirmDelete: 'Delete folder "{name}"? Assets remain in place.',
            rename: 'Rename',
            delete: 'Delete'
          }
        }
      }
    }
  }
})

const DropdownMenuRootStub = {
  name: 'DropdownMenuRoot',
  template: '<div><slot /></div>'
}
const DropdownMenuTriggerStub = {
  name: 'DropdownMenuTrigger',
  template: '<div><slot /></div>'
}
const DropdownMenuPortalStub = {
  name: 'DropdownMenuPortal',
  template: '<div><slot /></div>'
}
const DropdownMenuContentStub = {
  name: 'DropdownMenuContent',
  template: '<div><slot /></div>'
}
const DropdownMenuItemStub = {
  name: 'DropdownMenuItem',
  emits: ['select'],
  template: '<div @click="$emit(\'select\')"><slot /></div>'
}

async function mountSection() {
  const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
  const { useMoshpitFoldersStore } = await import(
    '@/platform/moshpit/stores/moshpitFoldersStore'
  )
  const { useMoshpitCurationStore } = await import(
    '@/platform/moshpit/stores/moshpitCurationStore'
  )
  const { useMoshpitFilterStore } = await import(
    '@/platform/moshpit/stores/moshpitFilterStore'
  )

  const foldersStore = useMoshpitFoldersStore(pinia)
  const curationStore = useMoshpitCurationStore(pinia)
  const filterStore = useMoshpitFilterStore(pinia)

  const idA = foldersStore.create('Alpha')
  const idB = foldersStore.create('Beta')

  // 2 assets in Alpha, 1 in Beta
  curationStore.curationByHash.set('h1', {
    favourite: false,
    tags: [],
    folders: [idA],
    hidden: false
  })
  curationStore.curationByHash.set('h2', {
    favourite: false,
    tags: [],
    folders: [idA, idB],
    hidden: false
  })

  const result = render(MoshpitFoldersSection, {
    global: {
      plugins: [pinia, i18n],
      stubs: {
        DropdownMenuRoot: DropdownMenuRootStub,
        DropdownMenuTrigger: DropdownMenuTriggerStub,
        DropdownMenuPortal: DropdownMenuPortalStub,
        DropdownMenuContent: DropdownMenuContentStub,
        DropdownMenuItem: DropdownMenuItemStub
      }
    }
  })

  return { result, idA, idB, foldersStore, curationStore, filterStore }
}

describe('MoshpitFoldersSection — folder list', () => {
  it('renders a row for each folder', async () => {
    await mountSection()
    expect(screen.getByTestId('moshpit-folder-row-Alpha')).not.toBeNull()
    expect(screen.getByTestId('moshpit-folder-row-Beta')).not.toBeNull()
  })

  it('clicking a folder row calls filterStore.addChip with param=folder', async () => {
    const user = userEvent.setup()
    const { filterStore } = await mountSection()
    const addChipSpy = vi.spyOn(filterStore, 'addChip')

    await user.click(screen.getByTestId('moshpit-folder-row-Alpha'))

    expect(addChipSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        param: 'folder',
        value: { kind: 'categorical', values: expect.any(Array) }
      })
    )
  })
})

describe('MoshpitFoldersSection — new folder', () => {
  it('renders the new folder button', async () => {
    await mountSection()
    expect(screen.getByTestId('moshpit-folders-new')).not.toBeNull()
  })

  it('clicking new folder button shows the inline input', async () => {
    const user = userEvent.setup()
    await mountSection()
    await user.click(screen.getByTestId('moshpit-folders-new'))
    expect(screen.getByTestId('moshpit-folders-new-input')).not.toBeNull()
  })

  it('typing a name and pressing Enter calls foldersStore.create', async () => {
    const user = userEvent.setup()
    const { foldersStore } = await mountSection()
    const createSpy = vi.spyOn(foldersStore, 'create')

    await user.click(screen.getByTestId('moshpit-folders-new'))
    const input = screen.getByTestId('moshpit-folders-new-input')
    await user.type(input, 'New List')
    await user.keyboard('{Enter}')

    expect(createSpy).toHaveBeenCalledWith('New List')
  })
})

describe('MoshpitFoldersSection — delete', () => {
  it('delete menu item calls foldersStore.remove after window.confirm = true', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const { foldersStore, idA } = await mountSection()
    const removeSpy = vi.spyOn(foldersStore, 'remove')

    const deleteBtn = screen.getByTestId(`moshpit-folder-delete-Alpha`)
    await user.click(deleteBtn)

    expect(removeSpy).toHaveBeenCalledWith(idA)
    vi.restoreAllMocks()
  })

  it('delete menu item does NOT call foldersStore.remove when window.confirm = false', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const { foldersStore } = await mountSection()
    const removeSpy = vi.spyOn(foldersStore, 'remove')

    const deleteBtn = screen.getByTestId(`moshpit-folder-delete-Alpha`)
    await user.click(deleteBtn)

    expect(removeSpy).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

describe('MoshpitFoldersSection — empty state', () => {
  it('renders empty state message when no folders exist', () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    render(MoshpitFoldersSection, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          DropdownMenuRoot: DropdownMenuRootStub,
          DropdownMenuTrigger: DropdownMenuTriggerStub,
          DropdownMenuPortal: DropdownMenuPortalStub,
          DropdownMenuContent: DropdownMenuContentStub,
          DropdownMenuItem: DropdownMenuItemStub
        }
      }
    })
    expect(screen.getByTestId('moshpit-folders-empty')).not.toBeNull()
  })
})
