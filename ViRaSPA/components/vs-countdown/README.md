# vs-countdown

A countdown to a moment, or for a number of seconds.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `full` |

## Install

```bash
node node-tools/install.js add component vs-countdown@0.1.0
```

Nothing else to do: it loads the first time `<vs-countdown>` appears.

## Usage

```html
<vs-countdown to="2026-12-31T23:59:59"></vs-countdown>
<vs-countdown seconds="90" format="{mm}:{ss}" finished-text="Time is up"></vs-countdown>
```

## Attributes

| Attribute | Meaning |
| --- | --- |
| `to` | The moment it counts down to (ISO date and time). |
| `seconds` | Or a number of seconds from when it appears. |
| `format` | Placeholders `{d}`, `{h}` `{hh}`, `{m}` `{mm}`, `{s}` `{ss}`; without `{d}` the hours are the total. Default: days only when there are some (`54d 03:12:09`, `03:12:09`, `12:09`). |
| `finished-text` | Shown (and announced) when it reaches zero. |

Methods: `start()`, `stop()`, `reset()`. It ticks on whole seconds.

## Events

`vs-tick` (`detail: { days, hours, minutes, seconds, totalSeconds }`) every second; `vs-finished` once.

## Accessibility

Screen readers hear it only when it finishes (one that announced every second would be noise).

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `registerCountDown`).