# vs-card

A content card: a heading, an optional subheading and icon, body content, and an optional footer.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-06) |
| Framework | ViRaSPA 0.1.0 or newer |
| Isolation | `full` (Shadow DOM) |

## Install

```bash
node node-tools/install.js add component vs-card@0.1.0
```

Nothing else to do: the framework loads it the first time `<vs-card>` appears on a page.

## Usage

```html
<vs-card heading="Leanne Graham" subheading="leanne@example.com" icon="lucide:user">
  Works in sales.
  <a slot="footer" href="/users/1">Open</a>
</vs-card>
```

```js
await Viraspa.core.mountComponent(Viraspa.components.VsCard, target, { heading: "Leanne Graham", subheading: "leanne@example.com" });
```

## Attributes and props

| Name | Type | Default | Meaning |
| --- | --- | --- | --- |
| `heading` | text | `""` | The card's title. |
| `subheading` | text | `""` | A line under the title; hidden when empty. |
| `icon` | icon | none | An icon before the title, e.g. `lucide:user` or `{ set, name }`. |

## Slots

| Slot | Content |
| --- | --- |
| (default) | The card's body. |
| `footer` | Actions or links; the footer area is hidden when empty. |

## Parts

`card`, `head`, `icon`, `heading`, `subheading`, `body`, `footer`. For example: `vs-card::part(heading) { color: crimson; }`

## CSS variables

| Variable | Default |
| --- | --- |
| `--vs-card-padding` | `0.85rem 1rem` |
| `--vs-card-background` | `var(--vs-color-surface)` |

## Events

None.

## Accessibility

- The heading is an `<h3>`. Put cards under a page section with an `<h2>`.

## Version history

- **0.1.0 (2026-11-06):** first release. Replaces the sample app's `app-card`, using `heading` instead of `title`, so no browser tooltip appears.
