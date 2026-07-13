# Reference consumer

Copy this TypeScript into an integration and adapt its exported types to the
host application's conventions.

```ts
type Prompt = Record<
  string,
  {
    inputs: Record<string, unknown>
    class_type: string
    _meta: { title: string }
  }
>

type AppSnapshotInputType =
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'color'
  | 'custom'

export interface AppSnapshotInput {
  id: string
  label: string
  type: AppSnapshotInputType
  required: boolean
  binding: {
    nodeId: string
    input: string
  }
  default?: unknown
  options?: Array<{ value: string | number; label: string }>
  minimum?: number
  maximum?: number
  step?: number
  widgetType?: string
  fallback?: 'json'
  ui?: {
    multiline?: boolean
    height?: number
  }
}

export interface AppSnapshotOutput {
  id: string
  label: string
  type: 'image' | 'video' | 'audio' | 'file'
  nodeId: string
}

export type AppSnapshotWarning =
  | {
      code: 'unresolved-input' | 'unsupported-value'
      message: string
      inputId: string
    }
  | {
      code: 'unresolved-output'
      message: string
      outputId: string
    }

export interface AppSnapshot {
  format: 'comfy.app-snapshot'
  formatVersion: 1
  metadata: {
    id: string
    name: string
    exportedAt: string
    frontendVersion?: string
  }
  interface: {
    inputs: AppSnapshotInput[]
    outputs: AppSnapshotOutput[]
  }
  requirements: { nodeClassTypes: string[] }
  prompt: Prompt
  workflow: unknown
  warnings?: AppSnapshotWarning[]
}

export function preparePrompt(
  app: AppSnapshot,
  values: Record<string, unknown>
): Prompt {
  if (app.format !== 'comfy.app-snapshot' || app.formatVersion !== 1) {
    throw new Error('Unsupported app snapshot format')
  }

  const prompt = structuredClone(app.prompt)
  const inputsById = new Map(
    app.interface.inputs.map((input) => [input.id, input])
  )

  for (const [inputId, value] of Object.entries(values)) {
    const descriptor = inputsById.get(inputId)
    if (!descriptor) throw new Error(`Unknown app input: ${inputId}`)

    const { nodeId, input } = descriptor.binding
    if (!Object.prototype.hasOwnProperty.call(prompt, nodeId)) {
      throw new Error(`Invalid prompt binding for app input: ${inputId}`)
    }
    const promptNode = prompt[nodeId]
    if (!Object.prototype.hasOwnProperty.call(promptNode.inputs, input)) {
      throw new Error(`Invalid prompt binding for app input: ${inputId}`)
    }
    promptNode.inputs[input] = value
  }

  return prompt
}
```
