export type MetadataField = 'model' | 'lora' | 'vae' | 'prompt'

export interface MetadataFilter {
  field: MetadataField
  value: string
}

export const METADATA_FIELDS: MetadataField[] = [
  'model',
  'lora',
  'vae',
  'prompt'
]
