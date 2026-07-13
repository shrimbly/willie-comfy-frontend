import { promotedInputWidgets } from '@/core/graph/subgraph/promotedInputWidget'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { LinearData } from '@/platform/workflow/management/stores/comfyWorkflow'
import type {
  AppSnapshot,
  AppSnapshotInput,
  AppSnapshotOutput,
  AppSnapshotWarning
} from '@/platform/workflow/validation/schemas/appSnapshotSchema'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { isWidgetId, parseWidgetId } from '@/types/widgetId'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'
import { resolveNode } from '@/utils/litegraphUtil'

import {
  getAppSnapshotComboOptions,
  inferAppSnapshotInputType,
  inferAppSnapshotOutputType
} from './appSnapshotWidgets'

interface CreateAppSnapshotOptions {
  name: string
  workflow: ComfyWorkflowJSON
  prompt: ComfyApiWorkflow
  rootGraph: LGraph
  linearData: LinearData
  exportedAt?: Date
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item'
  )
}

function uniqueId(label: string, used: Set<string>): string {
  const base = slugify(label)
  let id = base
  let suffix = 2
  while (used.has(id)) id = `${base}-${suffix++}`
  used.add(id)
  return id
}

function jsonValue(
  value: unknown
): { ok: true; value: unknown } | { ok: false } {
  if (!isJsonValue(value)) return { ok: false }
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) return { ok: false }
    return { ok: true, value: JSON.parse(serialized) }
  } catch {
    return { ok: false }
  }
}

function finiteNumber(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined
}

function isJsonValue(value: unknown, seen = new Set<object>()): boolean {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true
  }
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object' || seen.has(value)) return false

  const prototype = Object.getPrototypeOf(value)
  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    return false
  }

  seen.add(value)
  const values = Array.isArray(value) ? value : Object.values(value)
  const valid = values.every((item) => isJsonValue(item, seen))
  seen.delete(value)
  return valid
}

function buildInput(
  rootGraph: LGraph,
  prompt: ComfyApiWorkflow,
  selection: LinearData['inputs'][number],
  usedIds: Set<string>
): { input?: AppSnapshotInput; warning?: AppSnapshotWarning } {
  const [storedId, displayName, config] = selection
  if (!isWidgetId(storedId)) {
    return {
      warning: {
        code: 'unresolved-input',
        inputId: String(storedId),
        message: `Could not resolve app input "${displayName}".`
      }
    }
  }

  const { nodeId, name } = parseWidgetId(storedId)
  const node = rootGraph.getNodeById(nodeId)
  const widgets = node?.isSubgraphNode()
    ? promotedInputWidgets(node)
    : node?.widgets
  const widget = widgets?.find((candidate) => candidate.name === name)
  if (!node || !widget) {
    return {
      warning: {
        code: 'unresolved-input',
        inputId: storedId,
        message: `Could not resolve app input "${displayName}".`
      }
    }
  }

  const promoted = resolvePromotedWidgetSource(rootGraph, node, widget)
  const sourceNode = promoted?.sourceNode ?? node
  const sourceWidget = promoted?.sourceWidget ?? widget
  const inputName = promoted?.sourceWidgetName ?? widget.name
  const executionId =
    promoted?.sourceExecutionId ?? getExecutionIdByNode(rootGraph, node)
  const promptNode = executionId ? prompt[String(executionId)] : undefined
  if (
    !executionId ||
    !promptNode ||
    !Object.hasOwn(promptNode.inputs, inputName)
  ) {
    return {
      warning: {
        code: 'unresolved-input',
        inputId: storedId,
        message: `No prompt binding was found for app input "${displayName}".`
      }
    }
  }

  const defaultValue = jsonValue(promptNode.inputs[inputName])
  if (!defaultValue.ok) {
    return {
      warning: {
        code: 'unsupported-value',
        inputId: storedId,
        message: `App input "${displayName}" has a value that cannot be exported as JSON.`
      }
    }
  }

  const type = inferAppSnapshotInputType(
    sourceWidget,
    promptNode.class_type,
    inputName
  )
  const input: AppSnapshotInput = {
    id: uniqueId(displayName, usedIds),
    label: displayName,
    type,
    required: true,
    binding: { nodeId: String(executionId), input: inputName },
    default: defaultValue.value
  }

  if (type === 'select') {
    const options = getAppSnapshotComboOptions(sourceWidget, sourceNode)
    if (!options) {
      return {
        warning: {
          code: 'unresolved-input',
          inputId: storedId,
          message: `Could not resolve options for app input "${displayName}".`
        }
      }
    }
    input.options = options
  }
  if (type === 'number') {
    input.minimum = finiteNumber(sourceWidget.options.min)
    input.maximum = finiteNumber(sourceWidget.options.max)
    input.step = finiteNumber(
      sourceWidget.options.step2 ?? sourceWidget.options.step
    )
  }
  if (type === 'text' && (sourceWidget.options.multiline || config?.height)) {
    input.ui = {
      multiline: sourceWidget.options.multiline,
      height: config?.height
    }
  }
  if (type === 'custom') {
    input.widgetType = sourceWidget.type
    input.fallback = 'json'
  }
  return { input }
}

function buildOutput(
  rootGraph: LGraph,
  prompt: ComfyApiWorkflow,
  storedId: LinearData['outputs'][number],
  usedIds: Set<string>
): { output?: AppSnapshotOutput; warning?: AppSnapshotWarning } {
  const node = resolveNode(storedId, rootGraph)
  const executionId = node ? getExecutionIdByNode(rootGraph, node) : null
  const promptNode = executionId ? prompt[String(executionId)] : undefined
  if (!executionId || !promptNode) {
    return {
      warning: {
        code: 'unresolved-output',
        outputId: String(storedId),
        message: `Could not resolve app output "${String(storedId)}".`
      }
    }
  }

  const label = node?.title || promptNode._meta.title || promptNode.class_type
  return {
    output: {
      id: uniqueId(label, usedIds),
      label,
      type: inferAppSnapshotOutputType(promptNode.class_type, node?.outputs),
      nodeId: String(executionId)
    }
  }
}

export function createAppSnapshot({
  name,
  workflow,
  prompt,
  rootGraph,
  linearData,
  exportedAt = new Date()
}: CreateAppSnapshotOptions): AppSnapshot {
  const inputIds = new Set<string>()
  const outputIds = new Set<string>()
  const warnings: AppSnapshotWarning[] = []
  const inputs = linearData.inputs.flatMap((selection) => {
    const result = buildInput(rootGraph, prompt, selection, inputIds)
    if (result.warning) warnings.push(result.warning)
    return result.input ? [result.input] : []
  })
  const outputs = linearData.outputs.flatMap((storedId) => {
    const result = buildOutput(rootGraph, prompt, storedId, outputIds)
    if (result.warning) warnings.push(result.warning)
    return result.output ? [result.output] : []
  })
  const nodeClassTypes = [
    ...new Set(Object.values(prompt).map((node) => node.class_type))
  ].sort()

  return {
    format: 'comfy.app-snapshot',
    formatVersion: 1,
    metadata: {
      id: slugify(name),
      name,
      exportedAt: exportedAt.toISOString(),
      frontendVersion: workflow.extra?.frontendVersion
    },
    interface: { inputs, outputs },
    requirements: { nodeClassTypes },
    prompt,
    workflow,
    warnings: warnings.length ? warnings : undefined
  }
}
