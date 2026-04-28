import type { FolderTreeNodeType } from '@/platform/assets/components/FolderTreeNode.vue'

interface FolderTreeRoot {
  name: string
  path: string
}

export function buildOutputFolderTree(
  assetNames: readonly string[],
  root: FolderTreeRoot
): FolderTreeNodeType {
  const dirs = new Set<string>()
  for (const name of assetNames) {
    if (!name) continue
    const parts = name.split('/')
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/'))
    }
  }

  const rootNode: FolderTreeNodeType = {
    name: root.name,
    path: root.path,
    children: []
  }

  const nodeMap = new Map<string, FolderTreeNodeType>()
  nodeMap.set('', rootNode)

  for (const dir of Array.from(dirs).sort((a, b) => a.localeCompare(b))) {
    const parts = dir.split('/')
    const name = parts[parts.length - 1]
    const parentDir = parts.slice(0, -1).join('/')
    const node: FolderTreeNodeType = {
      name,
      path: `${root.path}/${dir}`,
      children: []
    }
    nodeMap.set(dir, node)
    ;(nodeMap.get(parentDir) ?? rootNode).children.push(node)
  }

  return rootNode
}

export function findNodeByPath(
  tree: FolderTreeNodeType,
  path: string
): FolderTreeNodeType | null {
  if (tree.path === path) return tree
  for (const child of tree.children) {
    const found = findNodeByPath(child, path)
    if (found) return found
  }
  return null
}
