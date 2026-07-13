# App Snapshot consumer integration

This document is a transport-neutral implementation brief for applications
that run ComfyUI App Mode workflows locally or through Comfy Cloud.

## Contract

Accept a single `.app.json` file only when:

- `format` is `comfy.app-snapshot`;
- `formatVersion` is a supported version;
- the rest of the document passes the App Snapshot schema.

The important sections are:

| Section             | Consumer responsibility                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `interface.inputs`  | Render controls and collect values.                                       |
| `interface.outputs` | Identify the declared result nodes.                                       |
| `prompt`            | Clone, patch through declared bindings, and submit for execution.         |
| `requirements`      | Report node class types the selected runtime must provide.                |
| `warnings`          | Surface interface elements the exporter could not safely bind.            |
| `workflow`          | Preserve for editing or provenance; do not inspect it to execute the app. |

## Input controls

Render controls from the declared type instead of inspecting ComfyUI nodes:

| Type                              | Expected control                                                        |
| --------------------------------- | ----------------------------------------------------------------------- |
| `image`, `video`, `audio`, `file` | Host media picker or selection. Upload before prompt submission.        |
| `text`                            | Text input; use `ui.multiline` when declared.                           |
| `number`                          | Numeric input using `minimum`, `maximum`, and `step`.                   |
| `boolean`                         | Checkbox or switch.                                                     |
| `select`                          | Dropdown using the declared string or numeric option values.            |
| `color`                           | Color control.                                                          |
| `custom`                          | JSON editor when `fallback` is `json`, or an unsupported-input message. |

Use every input `id` verbatim. IDs are stable handles within the exported
snapshot; labels are display text and are not bindings.

## Prepare a prompt

Use [`consumer.md`](./consumer.md) as the reference implementation:

1. Clone `app.prompt` so repeated executions do not mutate the snapshot.
2. Look up each supplied value by `interface.inputs[].id`.
3. Verify the bound prompt node and input are own properties.
4. Assign the value at `prompt[binding.nodeId].inputs[binding.input]`.
5. Submit the cloned prompt through the selected runtime transport.

For media inputs, upload the host media first and bind the filename or asset
reference expected by the target ComfyUI runtime.

Do not reconstruct the interface from `workflow`, node class names, or
`/object_info`. The exported interface and prompt bindings are the portable
execution contract.

## Runtime boundary

The snapshot deliberately does not define authentication or transport. The
consumer owns:

- local or cloud connection settings;
- media upload;
- prompt submission;
- progress polling and cancellation;
- output download;
- importing supported results into the host application.

Use the declared output node IDs to select results. If the host cannot import a
declared media type, report that limitation explicitly.

## Minimum verification

Cover these cases before shipping an integration:

- reject unknown formats and versions;
- reject invalid or unknown input bindings;
- preserve string and numeric dropdown values;
- apply number constraints and multiline UI hints;
- parse custom JSON without silently coercing values;
- clone prompts without mutating the loaded snapshot;
- upload and bind host media;
- select only declared output nodes;
- surface exporter warnings and unsupported media types.

## Coding-agent task

Use this repository's App Snapshot schema, example, and `preparePrompt` helper
as the source of truth. Implement the parser and prompt preparation as a small,
host-independent module. Connect host UI and runtime transport to that module,
but do not introduce node-graph parsing, widget inference, or an `/object_info`
dependency. Preserve existing host import/export behavior and add focused tests
for the verification cases above.
