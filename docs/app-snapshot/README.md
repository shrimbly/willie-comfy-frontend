# App Snapshot

An App Snapshot is a self-contained `.app.json` file exported from a workflow
configured in App Mode. It contains the editable workflow, the compiled API
prompt, and stable bindings for the inputs and outputs selected by the author.

## Export from ComfyUI

1. Open a workflow and enter App Mode.
2. Choose at least one input and one output for the App Mode interface.
3. Open the workflow menu and choose **Export App Snapshot**.

The downloaded file uses the workflow name with an `.app.json` extension.

## Integrate in another application

Copy the TypeScript from [`consumer.md`](./consumer.md) into an integration and patch values by
their descriptive IDs:

```ts
const prompt = preparePrompt(app, {
  'source-video': uploadedFilename,
  codec: 'av1'
})
```

Input IDs must be used verbatim from `app.interface.inputs`; consumers must not
derive IDs from labels.

Send `prompt` through the existing local or cloud ComfyUI execution API. Media
upload, queue polling, cancellation, and output download remain the consumer's
responsibility because those operations differ by runtime.

Unknown custom widgets are exported as `type: "custom"` with a JSON fallback.
Consumers can render a JSON editor or decline to support that input. Any input
or output that cannot be safely bound is omitted and recorded in the snapshot's
`warnings` array.

See [`INTEGRATION.md`](./INTEGRATION.md) for the complete consumer checklist and
[`example.app.json`](./example.app.json) for a schema-valid example. Run
`pnpm json-schema` to generate `schemas/app-snapshot-1.json` from the canonical
Zod schema.
