export interface PromptMetadata {
  model: string | null
  lora: string | null
  vae: string | null
  prompt: string | null
}

interface PromptNode {
  class_type?: string
  inputs?: Record<string, unknown>
  _meta?: Record<string, unknown>
}

type PromptData = Record<string, PromptNode>

function stripPath(name: string): string {
  const lastSep = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'))
  return lastSep >= 0 ? name.slice(lastSep + 1) : name
}

export function parsePromptMetadata(
  promptData: unknown
): PromptMetadata | null {
  if (!promptData || typeof promptData !== 'object') return null

  const nodes = promptData as PromptData
  let model: string | null = null
  const loras: string[] = []
  let vae: string | null = null
  let prompt: string | null = null

  for (const node of Object.values(nodes)) {
    if (!node.class_type || !node.inputs) continue

    const classType = node.class_type

    if (
      !model &&
      (classType === 'CheckpointLoaderSimple' ||
        classType === 'CheckpointLoader')
    ) {
      const name = node.inputs.ckpt_name
      if (typeof name === 'string') model = stripPath(name)
    }

    if (!model && classType === 'UNETLoader') {
      const name = node.inputs.unet_name
      if (typeof name === 'string') model = stripPath(name)
    }

    if (classType.includes('LoraLoader')) {
      const name = node.inputs.lora_name
      if (typeof name === 'string') loras.push(stripPath(name))
    }

    if (!vae && classType === 'VAELoader') {
      const name = node.inputs.vae_name
      if (typeof name === 'string') vae = stripPath(name)
    }

    if (!prompt && classType === 'CLIPTextEncode') {
      const text = node.inputs.text
      if (typeof text === 'string') prompt = text
    }
  }

  return {
    model,
    lora: loras.length > 0 ? loras.join(', ') : null,
    vae,
    prompt
  }
}
