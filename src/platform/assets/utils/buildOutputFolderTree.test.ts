import { describe, expect, it } from 'vitest'

import { buildOutputFolderTree, findNodeByPath } from './buildOutputFolderTree'

const root = { name: 'output', path: 'output' }

describe('buildOutputFolderTree', () => {
  it('returns an empty root when given no filenames', () => {
    const tree = buildOutputFolderTree([], root)
    expect(tree).toEqual({ name: 'output', path: 'output', children: [] })
  })

  it('skips top-level files (no directory segment)', () => {
    const tree = buildOutputFolderTree(['image.png', 'other.png'], root)
    expect(tree.children).toEqual([])
  })

  it('extracts a single-level directory', () => {
    const tree = buildOutputFolderTree(['sub/image.png'], root)
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toMatchObject({
      name: 'sub',
      path: 'output/sub',
      children: []
    })
  })

  it('builds nested directory structure', () => {
    const tree = buildOutputFolderTree(
      ['a/b/c/file.png', 'a/b/other.png', 'a/sibling.png'],
      root
    )
    expect(tree.children).toHaveLength(1)
    const a = tree.children[0]
    expect(a).toMatchObject({ name: 'a', path: 'output/a' })
    expect(a.children).toHaveLength(1)
    const b = a.children[0]
    expect(b).toMatchObject({ name: 'b', path: 'output/a/b' })
    expect(b.children).toHaveLength(1)
    expect(b.children[0]).toMatchObject({ name: 'c', path: 'output/a/b/c' })
  })

  it('deduplicates directories across multiple files', () => {
    const tree = buildOutputFolderTree(
      ['dir/a.png', 'dir/b.png', 'dir/c.png'],
      root
    )
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0].name).toBe('dir')
  })

  it('sorts siblings alphabetically', () => {
    const tree = buildOutputFolderTree(
      ['zeta/x.png', 'alpha/x.png', 'mango/x.png'],
      root
    )
    expect(tree.children.map((c) => c.name)).toEqual(['alpha', 'mango', 'zeta'])
  })

  it('ignores empty filenames', () => {
    const tree = buildOutputFolderTree(['', 'sub/a.png', ''], root)
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0].name).toBe('sub')
  })

  it('honours a custom root name/path', () => {
    const tree = buildOutputFolderTree(['sub/a.png'], {
      name: 'My Output',
      path: 'custom'
    })
    expect(tree.name).toBe('My Output')
    expect(tree.path).toBe('custom')
    expect(tree.children[0].path).toBe('custom/sub')
  })
})

describe('findNodeByPath', () => {
  const tree = buildOutputFolderTree(
    ['a/b/c/file.png', 'a/sibling.png', 'z/y.png'],
    root
  )

  it('returns the root when asked for the root path', () => {
    expect(findNodeByPath(tree, 'output')).toBe(tree)
  })

  it('finds a deeply nested node by path', () => {
    const node = findNodeByPath(tree, 'output/a/b/c')
    expect(node).not.toBeNull()
    expect(node!.name).toBe('c')
  })

  it('returns null when path does not exist', () => {
    expect(findNodeByPath(tree, 'output/missing')).toBeNull()
  })
})
