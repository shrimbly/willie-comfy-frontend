import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'

import { useGraphHierarchy } from '@/composables/graph/useGraphHierarchy'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

export interface TemplateVariable {
  name: string
  description: string
}

// eslint-disable-next-line no-control-regex
const FILESYSTEM_INVALID_CHARS = /[/?<>\\:*|"\x00-\x1F\x7F]/g

export const BUILT_IN_TEMPLATE_VARIABLES: TemplateVariable[] = [
  { name: 'project', description: 'templateVariables.projectDesc' },
  { name: 'workflowTitle', description: 'templateVariables.workflowTitleDesc' },
  { name: 'groupTitle', description: 'templateVariables.groupTitleDesc' },
  { name: 'nodeTitle', description: 'templateVariables.nodeTitleDesc' }
]

/** @deprecated Use BUILT_IN_TEMPLATE_VARIABLES instead */
export const TEMPLATE_VARIABLES = BUILT_IN_TEMPLATE_VARIABLES

const BUILT_IN_NAMES = new Set(BUILT_IN_TEMPLATE_VARIABLES.map((v) => v.name))

function sanitize(value: string): string {
  return value.replaceAll(FILESYSTEM_INVALID_CHARS, '_')
}

type VariableResolver = (
  graph: LGraph | Subgraph,
  node: LGraphNode
) => string | null

const resolvers: Record<string, VariableResolver> = {
  project: () => 'My-project',
  workflowTitle: () => useWorkflowStore().activeWorkflow?.filename ?? null,
  groupTitle: (_graph, node) =>
    useGraphHierarchy().findParentGroup(node)?.title ?? null,
  nodeTitle: (_graph, node) => node.title ?? null
}

function getCustomVariables(): TemplateVariable[] {
  const custom = useSettingStore().get('Comfy.Filename.CustomVariables')
  return custom.map((v) => ({
    name: v.name,
    description: v.value
  }))
}

function getCustomVariableValue(name: string): string | null {
  const custom = useSettingStore().get('Comfy.Filename.CustomVariables')
  const found = custom.find((v) => v.name === name)
  return found?.value ?? null
}

function resolveVariable(
  name: string,
  graph: LGraph | Subgraph,
  node: LGraphNode
): string | null {
  const resolver = resolvers[name]
  if (resolver) return resolver(graph, node)
  return getCustomVariableValue(name)
}

function getAllVariableNames(): Set<string> {
  const names = new Set(BUILT_IN_NAMES)
  for (const v of getCustomVariables()) {
    names.add(v.name)
  }
  return names
}

export function resolveTemplateVariables(
  graph: LGraph | Subgraph,
  node: LGraphNode,
  value: string
): string {
  return value.replace(/@(\w+)/g, (match, name: string) => {
    const resolved = resolveVariable(name, graph, node)
    if (resolved === null) return match
    return sanitize(resolved)
  })
}

export type TemplateSegment =
  | { type: 'text'; value: string }
  | { type: 'variable'; name: string }

export function parseTemplateSegments(value: string): TemplateSegment[] {
  const variableNames = getAllVariableNames()
  const segments: TemplateSegment[] = []
  let lastIndex = 0

  for (const match of value.matchAll(/@(\w+)/g)) {
    const name = match[1]
    if (!variableNames.has(name)) continue

    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        value: value.slice(lastIndex, match.index)
      })
    }
    segments.push({ type: 'variable', name })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < value.length) {
    segments.push({ type: 'text', value: value.slice(lastIndex) })
  }

  return segments
}

export function previewResolvedValue(
  graph: LGraph | Subgraph,
  node: LGraphNode,
  value: string
): string {
  return value.replace(/@(\w+)/g, (match, name: string) => {
    const resolved = resolveVariable(name, graph, node)
    return resolved ?? match
  })
}

export function getTemplateVariables(): TemplateVariable[] {
  return [...BUILT_IN_TEMPLATE_VARIABLES, ...getCustomVariables()]
}
