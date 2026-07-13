import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LinearData } from '@/platform/workflow/management/stores/comfyWorkflow'
import { zAppSnapshot } from '@/platform/workflow/validation/schemas/appSnapshotSchema'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'
import { getWidgetIdForNode } from '@/utils/litegraphUtil'

import { createAppSnapshot } from './appSnapshot'

function workflow(): ComfyWorkflowJSON {
  return {
    last_node_id: 2,
    last_link_id: 0,
    nodes: [],
    links: [],
    groups: [],
    config: {},
    version: 0.4,
    extra: { frontendVersion: '1.48.1' }
  }
}

describe('createAppSnapshot', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('exports compiled defaults, standard controls, outputs, and requirements', () => {
    const graph = new LGraph()
    const loader = new LGraphNode('Load Video')
    loader.type = 'LoadVideo'
    graph.add(loader)
    const sourceVideo = loader.addWidget(
      'combo',
      'video',
      'input.mp4',
      () => undefined,
      { values: ['input.mp4'] }
    )

    const controls = new LGraphNode('Controls')
    controls.type = 'VideoControls'
    graph.add(controls)
    const codec = controls.addWidget(
      'combo',
      'codec',
      'h264',
      () => undefined,
      { values: { h264: 'H.264', av1: 'AV1' } }
    )
    const quality = controls.addWidget(
      'slider',
      'quality',
      80,
      () => undefined,
      { min: 0, max: 100, step2: 1 }
    )
    const imageWidth = controls.addWidget(
      'number',
      'image_width',
      1920,
      () => undefined
    )

    const output = new LGraphNode('Save Video')
    output.type = 'SaveVideo'
    graph.add(output)

    const conversion = new LGraphNode('Extract Frames')
    conversion.type = 'VideoToImage'
    conversion.addOutput('images', 'IMAGE')
    graph.add(conversion)

    const controlsId = String(controls.id)
    const loaderId = String(loader.id)
    const outputId = String(output.id)
    const conversionId = String(conversion.id)
    const prompt: ComfyApiWorkflow = {
      [loaderId]: {
        inputs: { video: 'input.mp4' },
        class_type: 'LoadVideo',
        _meta: { title: 'Load Video' }
      },
      [controlsId]: {
        inputs: { codec: 'av1', quality: 72, image_width: 1920 },
        class_type: 'VideoControls',
        _meta: { title: 'Controls' }
      },
      [outputId]: {
        inputs: {},
        class_type: 'SaveVideo',
        _meta: { title: 'Save Video' }
      },
      [conversionId]: {
        inputs: {},
        class_type: 'VideoToImage',
        _meta: { title: 'Extract Frames' }
      }
    }
    const linearData: LinearData = {
      inputs: [
        [getWidgetIdForNode(loader, sourceVideo)!, 'Source video'],
        [getWidgetIdForNode(controls, codec)!, 'Codec'],
        [getWidgetIdForNode(controls, quality)!, 'Quality'],
        [getWidgetIdForNode(controls, imageWidth)!, 'Image width']
      ],
      outputs: [output.id, conversion.id]
    }

    const snapshot = createAppSnapshot({
      name: 'Video enhancer',
      workflow: workflow(),
      prompt,
      rootGraph: graph,
      linearData,
      exportedAt: new Date('2026-07-11T00:00:00.000Z')
    })

    expect(snapshot.interface.inputs).toEqual([
      expect.objectContaining({
        id: 'source-video',
        type: 'video',
        default: 'input.mp4',
        binding: { nodeId: loaderId, input: 'video' }
      }),
      expect.objectContaining({
        id: 'codec',
        type: 'select',
        default: 'av1',
        binding: { nodeId: controlsId, input: 'codec' },
        options: [
          { value: 'h264', label: 'H.264' },
          { value: 'av1', label: 'AV1' }
        ]
      }),
      expect.objectContaining({
        id: 'quality',
        type: 'number',
        default: 72,
        minimum: 0,
        maximum: 100,
        step: 1
      }),
      expect.objectContaining({
        id: 'image-width',
        type: 'number',
        default: 1920
      })
    ])
    expect(snapshot.interface.outputs).toEqual([
      {
        id: 'save-video',
        label: 'Save Video',
        type: 'video',
        nodeId: outputId
      },
      {
        id: 'extract-frames',
        label: 'Extract Frames',
        type: 'image',
        nodeId: conversionId
      }
    ])
    expect(snapshot.requirements.nodeClassTypes).toEqual([
      'LoadVideo',
      'SaveVideo',
      'VideoControls',
      'VideoToImage'
    ])
    expect(snapshot.metadata).toEqual({
      id: 'video-enhancer',
      name: 'Video enhancer',
      exportedAt: '2026-07-11T00:00:00.000Z',
      frontendVersion: '1.48.1'
    })
    expect(snapshot.warnings).toBeUndefined()
    expect(zAppSnapshot.parse(snapshot)).toEqual(snapshot)
  })

  it('exports unknown widgets with a JSON fallback', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Custom')
    node.type = 'CustomNode'
    graph.add(node)
    const widget = node.addWidget(
      'custom',
      'settings',
      { strength: 0.5 },
      () => undefined
    )
    const nodeId = String(node.id)
    const prompt: ComfyApiWorkflow = {
      [nodeId]: {
        inputs: { settings: { strength: 0.75 } },
        class_type: 'CustomNode',
        _meta: { title: 'Custom' }
      }
    }

    const snapshot = createAppSnapshot({
      name: 'Custom',
      workflow: workflow(),
      prompt,
      rootGraph: graph,
      linearData: {
        inputs: [[getWidgetIdForNode(node, widget)!, 'Settings']],
        outputs: [node.id]
      }
    })

    expect(snapshot.interface.inputs[0]).toEqual(
      expect.objectContaining({
        type: 'custom',
        widgetType: 'custom',
        fallback: 'json',
        default: { strength: 0.75 }
      })
    )
    expect(snapshot.warnings).toBeUndefined()
  })

  it('warns when dynamic select options cannot be resolved', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Dynamic options')
    node.type = 'DynamicOptions'
    graph.add(node)
    const widget = node.addWidget(
      'combo',
      'choice',
      'default',
      () => undefined,
      {
        values: () => {
          throw new Error('Options unavailable')
        }
      }
    )
    const nodeId = String(node.id)

    const snapshot = createAppSnapshot({
      name: 'Dynamic options',
      workflow: workflow(),
      prompt: {
        [nodeId]: {
          inputs: { choice: 'default' },
          class_type: 'DynamicOptions',
          _meta: { title: 'Dynamic options' }
        }
      },
      rootGraph: graph,
      linearData: {
        inputs: [[getWidgetIdForNode(node, widget)!, 'Choice']],
        outputs: [node.id]
      }
    })

    expect(snapshot.interface.inputs).toEqual([])
    expect(snapshot.warnings).toEqual([
      expect.objectContaining({
        code: 'unresolved-input',
        message: 'Could not resolve options for app input "Choice".'
      })
    ])
  })

  it('omits non-finite numeric constraints', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Numeric limits')
    node.type = 'NumericLimits'
    graph.add(node)
    const widget = node.addWidget('number', 'strength', 0.5, () => undefined, {
      min: Number.NEGATIVE_INFINITY,
      max: Number.POSITIVE_INFINITY,
      step2: Number.NaN
    })
    const nodeId = String(node.id)

    const snapshot = createAppSnapshot({
      name: 'Numeric limits',
      workflow: workflow(),
      prompt: {
        [nodeId]: {
          inputs: { strength: 0.5 },
          class_type: 'NumericLimits',
          _meta: { title: 'Numeric limits' }
        }
      },
      rootGraph: graph,
      linearData: {
        inputs: [[getWidgetIdForNode(node, widget)!, 'Strength']],
        outputs: [node.id]
      }
    })

    expect(snapshot.interface.inputs[0]).toEqual(
      expect.objectContaining({
        type: 'number',
        minimum: undefined,
        maximum: undefined,
        step: undefined
      })
    )
    expect(JSON.stringify(snapshot)).not.toContain('null')
    expect(zAppSnapshot.parse(snapshot)).toEqual(snapshot)
  })

  it('records unresolved bindings instead of silently exporting them', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Missing binding')
    graph.add(node)
    const widget = node.addWidget('text', 'prompt', 'hello', () => undefined)

    const snapshot = createAppSnapshot({
      name: 'Incomplete',
      workflow: workflow(),
      prompt: {},
      rootGraph: graph,
      linearData: {
        inputs: [[getWidgetIdForNode(node, widget)!, 'Prompt']],
        outputs: [toNodeId(999)]
      }
    })

    expect(snapshot.interface).toEqual({ inputs: [], outputs: [] })
    expect(snapshot.warnings?.map((warning) => warning.code)).toEqual([
      'unresolved-input',
      'unresolved-output'
    ])
    expect(snapshot.warnings?.[1]).toEqual(
      expect.objectContaining({ outputId: '999' })
    )
  })

  it('rejects values that JSON would silently coerce or omit', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Unsafe values')
    node.type = 'UnsafeValues'
    graph.add(node)
    const invalidNumber = node.addWidget(
      'number',
      'invalid_number',
      0,
      () => undefined
    )
    const invalidObject = node.addWidget(
      'custom',
      'invalid_object',
      {},
      () => undefined
    )
    const nodeId = String(node.id)

    const snapshot = createAppSnapshot({
      name: 'Unsafe',
      workflow: workflow(),
      prompt: {
        [nodeId]: {
          inputs: {
            invalid_number: Number.NaN,
            invalid_object: { nested: undefined }
          },
          class_type: 'UnsafeValues',
          _meta: { title: 'Unsafe values' }
        }
      },
      rootGraph: graph,
      linearData: {
        inputs: [
          [getWidgetIdForNode(node, invalidNumber)!, 'Invalid number'],
          [getWidgetIdForNode(node, invalidObject)!, 'Invalid object']
        ],
        outputs: [node.id]
      }
    })

    expect(snapshot.interface.inputs).toEqual([])
    expect(snapshot.warnings?.map((warning) => warning.code)).toEqual([
      'unsupported-value',
      'unsupported-value'
    ])
  })
})
