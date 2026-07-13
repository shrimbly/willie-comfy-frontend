import { z } from 'zod'

import {
  zComfyWorkflow,
  zComfyWorkflow1
} from '@/platform/workflow/validation/schemas/workflowSchema'

const zPromptNode = z.object({
  inputs: z.record(z.string(), z.unknown()),
  class_type: z.string(),
  _meta: z.object({ title: z.string() })
})

const zAppSnapshotOption = z.object({
  value: z.union([z.string(), z.number()]),
  label: z.string()
})

const zAppSnapshotBinding = z.object({
  nodeId: z.string(),
  input: z.string()
})

const zAppSnapshotInput = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum([
    'image',
    'video',
    'audio',
    'file',
    'text',
    'number',
    'boolean',
    'select',
    'color',
    'custom'
  ]),
  required: z.boolean(),
  binding: zAppSnapshotBinding,
  default: z.unknown().optional(),
  options: z.array(zAppSnapshotOption).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  step: z.number().optional(),
  widgetType: z.string().optional(),
  fallback: z.literal('json').optional(),
  ui: z
    .object({
      multiline: z.boolean().optional(),
      height: z.number().optional()
    })
    .optional()
})

const zAppSnapshotOutput = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['image', 'video', 'audio', 'file']),
  nodeId: z.string()
})

const zAppSnapshotWarning = z.discriminatedUnion('code', [
  z.object({
    code: z.literal('unresolved-input'),
    message: z.string(),
    inputId: z.string()
  }),
  z.object({
    code: z.literal('unsupported-value'),
    message: z.string(),
    inputId: z.string()
  }),
  z.object({
    code: z.literal('unresolved-output'),
    message: z.string(),
    outputId: z.string()
  })
])

export const zAppSnapshot = z.object({
  format: z.literal('comfy.app-snapshot'),
  formatVersion: z.literal(1),
  metadata: z.object({
    id: z.string(),
    name: z.string(),
    exportedAt: z.string().datetime(),
    frontendVersion: z.string().optional()
  }),
  interface: z.object({
    inputs: z.array(zAppSnapshotInput),
    outputs: z.array(zAppSnapshotOutput)
  }),
  requirements: z.object({
    nodeClassTypes: z.array(z.string())
  }),
  prompt: z.record(z.string(), zPromptNode),
  workflow: z.union([zComfyWorkflow, zComfyWorkflow1]),
  warnings: z.array(zAppSnapshotWarning).optional()
})

export type AppSnapshot = z.infer<typeof zAppSnapshot>
export type AppSnapshotInput = z.infer<typeof zAppSnapshotInput>
export type AppSnapshotOutput = z.infer<typeof zAppSnapshotOutput>
export type AppSnapshotWarning = z.infer<typeof zAppSnapshotWarning>
