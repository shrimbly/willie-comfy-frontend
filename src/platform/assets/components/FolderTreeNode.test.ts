import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import FolderTreeNode from '@/platform/assets/components/FolderTreeNode.vue'

const tree = {
  name: 'Output',
  path: '/out',
  children: [
    { name: 'bot-left', path: '/out/bot-left', children: [] },
    {
      name: 'comfy',
      path: '/out/comfy',
      children: [
        {
          name: 'inner',
          path: '/out/comfy/inner',
          children: [
            { name: 'deepest', path: '/out/comfy/inner/deepest', children: [] }
          ]
        }
      ]
    }
  ]
}

describe('FolderTreeNode expansion', () => {
  it('expands root only by default', () => {
    render(FolderTreeNode, {
      props: { node: tree, selectedPath: '', depth: 0 }
    })
    expect(screen.getByText('Output')).toBeTruthy()
    expect(screen.getByText('bot-left')).toBeTruthy()
    expect(screen.getByText('comfy')).toBeTruthy()
    expect(screen.queryByText('inner')).toBeNull()
  })

  it('expands one more level when expandedDepth=1', () => {
    render(FolderTreeNode, {
      props: { node: tree, selectedPath: '', depth: 0, expandedDepth: 1 }
    })
    expect(screen.getByText('comfy')).toBeTruthy()
    expect(screen.getByText('inner')).toBeTruthy()
    expect(screen.queryByText('deepest')).toBeNull()
  })

  it('keeps root collapsed when expandedDepth=-1', () => {
    render(FolderTreeNode, {
      props: { node: tree, selectedPath: '', depth: 0, expandedDepth: -1 }
    })
    expect(screen.getByText('Output')).toBeTruthy()
    expect(screen.queryByText('bot-left')).toBeNull()
  })
})
