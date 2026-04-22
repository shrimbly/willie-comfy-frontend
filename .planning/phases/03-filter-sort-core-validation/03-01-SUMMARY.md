---
phase: 03-filter-sort-core-validation
plan: '01'
subsystem: moshpit/services
tags: [moshpit, filter, param-extraction, worker, zod, tdd]
dependency_graph:
  requires: []
  provides:
    - src/platform/moshpit/services/paramNormalize.ts
  affects:
    - src/platform/moshpit/services/thumbWorker.ts (plan 03-05 wires normalizeParams)
    - src/platform/moshpit/services/workerMessages.ts (plan 03-05 extends ThumbReadyMessage with params)
    - src/platform/moshpit/services/filterMath.ts (plan 03-02 consumes NormalizedParams)
    - src/platform/moshpit/services/sortMath.ts (plan 03-03 consumes NormalizedParams)
    - src/platform/moshpit/stores/moshpitFilterStore.ts (plan 03-06 depends on NormalizedParams shape)
tech_stack:
  added: []
  patterns:
    - Worker-safe pure leaf module (no Vue/Pinia/DOM, only zod import)
    - Zod schema for runtime validation + type inference (NormalizedParamsSchema)
    - TDD red-green cycle on a shared module contract
key_files:
  created:
    - src/platform/moshpit/services/paramNormalize.ts
    - src/platform/moshpit/services/paramNormalize.test.ts
  modified: []
decisions:
  - D-05 shape extended with workflowFingerprint (string) and workflowFilename (string | null) per deviation_note
  - workflowFingerprint uses pipe-joined sorted unique class_types (e.g. 'CheckpointLoaderSimple|KSampler')
  - workflowFilename derived by extractWorkflowFilename from PNG output filename stem
  - resolvePrompts only follows array refs [nodeId, outputIndex] — plain string positive/negative values return undefined (D-02)
  - emptyParams returns workflowFingerprint as empty string (not undefined) for Zod compliance
  - NormalizedParams is z.infer<typeof NormalizedParamsSchema> — single source of truth
  - OQ-3 resolved: workflow picker displayName uses workflowFilename when non-null, falls back to 'unnamed-' + workflowFingerprint
metrics:
  duration_minutes: 25
  completed_date: '2026-04-20'
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 03 Plan 01: paramNormalize — Worker-Safe Parameter Extraction

**One-liner:** Worker-safe `normalizeParams` + Zod-validated `NormalizedParams` shape extracting 14 typed fields (12 core D-05 + `workflowFingerprint` + `workflowFilename`) from ComfyUI PNG `prompt` metadata.

## What Was Built

A pure TypeScript leaf module `paramNormalize.ts` that:

1. Parses the `prompt` tEXt chunk from ComfyUI PNG metadata (API format — inputs-by-name object keyed by node ID)
2. Extracts typed parameters into a `NormalizedParams` record used by every Phase 3 filter chip, sort axis, and workflow picker entry
3. Exports a Zod schema (`NormalizedParamsSchema`) for runtime validation and type inference
4. Exports `extractWorkflowFilename` for reuse by Plan 03-05 (worker wiring)
5. Is fully worker-safe — no Vue, Pinia, or DOM imports; sole runtime dep is `zod`

The TDD test suite (`paramNormalize.test.ts`) covers 32 test cases across:

- Empty/malformed metadata handling
- KSampler field extraction (cfg, steps, sampler, scheduler, seed)
- CheckpointLoaderSimple model extraction
- LoraLoader array extraction (with strength_model / strength fallback, weight=1 default)
- EmptyLatentImage width/height extraction
- CLIPTextEncode positive/negative prompt resolution via array refs
- workflowFingerprint determinism (same class_type set → same fingerprint regardless of node ID order)
- workflowFilename heuristic (path stripping, extension stripping, counter suffix stripping)
- Zod schema round-trip validation

## Final Exported Interface

```typescript
// NormalizedParams shape (D-05 + deviation_note extension)
export interface NormalizedParams {
  readonly model: string | undefined               // CheckpointLoaderSimple.ckpt_name
  readonly loras: readonly { name: string; weight: number }[]  // LoraLoader* nodes
  readonly cfg: number | undefined                 // KSampler*.cfg
  readonly steps: number | undefined               // KSampler*.steps
  readonly sampler: string | undefined             // KSampler*.sampler_name
  readonly scheduler: string | undefined           // KSampler*.scheduler
  readonly seed: number | undefined                // KSampler*.seed
  readonly positivePrompt: string | undefined      // CLIPTextEncode via KSampler.positive ref
  readonly negativePrompt: string | undefined      // CLIPTextEncode via KSampler.negative ref
  readonly width: number | undefined               // EmptyLatentImage*.width
  readonly height: number | undefined              // EmptyLatentImage*.height
  readonly timestamp: number                       // always defined; epoch ms (D-05)
  readonly workflowFingerprint: string             // sorted unique class_types, pipe-joined
  readonly workflowFilename: string | null         // PNG filename stem heuristic; null if unknown
}

// Function signatures
export function normalizeParams(
  rawMeta: Readonly<Record<string, string>>,
  createdAtMs: number,
  sourceFilename?: string | null
): NormalizedParams

export function emptyParams(createdAtMs: number): NormalizedParams

export function extractWorkflowFilename(
  sourceFilename: string | null | undefined
): string | null

export const NormalizedParamsSchema: z.ZodObject<...>
```

## ComfyUI Class-Type Assumptions (A1-A3)

These were confirmed sufficient for the test suite and are consistent with RESEARCH.md Assumptions A1-A3:

- **A1 (KSampler):** Handles `KSampler`, `KSamplerAdvanced`, `KSampler (Efficient)`. Fields `inputs.cfg`, `inputs.steps`, `inputs.sampler_name`, `inputs.scheduler`, `inputs.seed` all extracted via typeof guards. If a workflow uses a different KSampler variant not in this list, those fields return `undefined` (D-03 silent-null).
- **A2 (CLIPTextEncode):** KSampler's `positive`/`negative` inputs are expected to be array refs `[nodeId, outputIndex]`. Plain string values (e.g. direct text injection) return `undefined` per the v1 decision to only resolve CLIPTextEncode refs. This is intentional and tested (Test 10).
- **A3 (LoRA):** Handles `LoraLoader`, `LoraLoaderModelOnly`, `LoraTagLoader`. Reads `lora_name` (with `lora_tag` fallback) and `strength_model` (with `strength` fallback, then `1`). Nodes with empty/missing lora_name are silently dropped.

## Sort-by-LoRA-Count Confirmation

Per D-04, `loras.length` is the sort axis for LoRA count. The `loras` array in `NormalizedParams` contains all parsed LoRA entries, so downstream `sortMath.ts` reads `params.loras.length` directly. Sort-by-LoRA-weight is deferred to v2.

## OQ-3 Resolution (Workflow Picker DisplayName)

**Open Question 3** asked: how does the workflow picker show a human-recognizable label when no workflow filename is embedded in the PNG metadata?

**Resolution implemented here:**

- `workflowFilename`: derived from the PNG output filename stem (stripped of path, extension, and ComfyUI counter suffix `_NNNNN_`). Example: `my_cfg_sweep_00042_.png` → `'my_cfg_sweep'`. This is `null` when the source filename is unavailable.
- `workflowFingerprint`: always a string (may be empty); sorted unique class_type set pipe-joined. Example: `'CheckpointLoaderSimple|KSampler'`. Deterministic for the same workflow topology regardless of node ID assignments or ordering.
- **Picker displayName logic (Plan 03-07):** Use `workflowFilename` when non-null; otherwise fall back to `'unnamed-' + workflowFingerprint`.

## D-05 Shape Extension Note

The D-05 shape in CONTEXT.md lists 12 core fields. This plan adds two derived identification fields per the plan's `deviation_note`:

| Field                 | Type             | Always defined?                 | Source                                      |
| --------------------- | ---------------- | ------------------------------- | ------------------------------------------- |
| `workflowFingerprint` | `string`         | Yes (empty string if no prompt) | Sorted unique class_types from prompt graph |
| `workflowFilename`    | `string \| null` | Yes (null if no sourceFilename) | PNG output filename stem heuristic          |

Both fields are included in `NormalizedParamsSchema` and validated by Zod.

## Deviations from Plan

None — plan executed exactly as written. The deviation documented in the plan frontmatter (`deviation_note`) was anticipated and implemented as specified: `workflowFingerprint` and `workflowFilename` added to D-05 shape, `extractWorkflowFilename` exported for downstream reuse.

## Self-Check: PASSED

- [x] `src/platform/moshpit/services/paramNormalize.ts` exists
- [x] `src/platform/moshpit/services/paramNormalize.test.ts` exists
- [x] Commit `d8d9da461` exists (test — RED state)
- [x] Commit `55689d33d` exists (feat — GREEN state)
- [x] 32 `it()` blocks in test file (≥25 required)
- [x] 5 exports in implementation (`normalizeParams`, `emptyParams`, `extractWorkflowFilename`, `NormalizedParamsSchema`, `NormalizedParams` type)
- [x] No forbidden imports (worker-safe)
- [x] No `any` / `as any` / `@ts-expect-error` in implementation code
- [x] All 32 tests pass
- [x] `pnpm typecheck` — 0 errors in paramNormalize files
- [x] `oxlint` and `eslint` — 0 errors/warnings on both files
