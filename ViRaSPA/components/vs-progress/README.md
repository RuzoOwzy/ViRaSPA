# vs-progress

Progress as a bar, a ring or dots: how far a task has come, or that it is still going.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `full` |

## Install

```bash
node node-tools/install.js add component vs-progress@0.1.0
```

Nothing else to do: it loads the first time `<vs-progress>` appears.

## Usage

```html
<vs-progress value="40"></vs-progress>
<vs-progress type="ring" value="3" max="8" show-value="count"></vs-progress>
<vs-progress type="dots" label="Loading orders"></vs-progress>
```

## Attributes

| Attribute | Default | Meaning |
| --- | --- | --- |
| `type` | `bar` | `bar`, `ring` or `dots`. |
| `value` | none | Without a value it is indeterminate (the bar slides, the ring spins, the dots pulse). |
| `max` | `100` | |
| `show-value` | off | Shows `40%`, or `3 / 8` with `show-value="count"`. |
| `label` | "Progress" | Read by screen readers. |

Colours and size: `--vs-progress-color`, `--vs-progress-track`, `--vs-progress-size`. For a page-wide loading line use `Viraspa.busy` (the core's top line).

## Accessibility

`role="progressbar"` with `aria-valuenow`/`aria-valuemax` when there is a value. Animations slow down with "reduce motion".

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `FIITPrg` and the ajax progress animations, now in CSS).