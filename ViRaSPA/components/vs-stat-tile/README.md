# vs-stat-tile

A key figure for dashboards: a label, a big value, an optional icon and a trend.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-06) |
| Framework | ViRaSPA 0.2.0 or newer |
| Isolation | `full` (Shadow DOM) |

## Install

```bash
node node-tools/install.js add component vs-stat-tile --version 0.1.0
```

## Usage

```html
<vs-stat-tile label="Sales Today" value="TZS 1,250,000" icon="lucide:banknote"
              trend="up" trend-text="+12% vs yesterday"></vs-stat-tile>
```

## Attributes and props

| Name | Type | Default | Meaning |
| --- | --- | --- | --- |
| `label` | text | `""` | What the figure is. |
| `value` | text | `""` | The figure, already formatted (number formatting arrives with i18n). |
| `icon` | icon | none | E.g. `lucide:banknote`. |
| `trend` | `up` \| `down` \| `flat` | none | Colours the trend line and adds ▲ ▼ ■. |
| `trend-text` (`trendText`) | text | `""` | E.g. "+12% vs yesterday". |

## Slots

None.

## Parts

`tile`, `label`, `icon`, `value`, `trend`.

## CSS variables

| Variable | Default |
| --- | --- |
| `--vs-stat-tile-background` | `var(--vs-color-surface)` |
| `--vs-stat-tile-icon-color` | `var(--vs-color-primary)` |
| `--vs-stat-tile-value-size` | `1.6rem` |

## Events

None.

## Accessibility

- The arrow is hidden from screen readers. They hear "Up:", "Down:" or "No change:" before the trend text.

## Version history

- **0.1.0 (2026-11-06):** first release.
