# vs-tabs

Tabs from labelled child panels, with ARIA keyboard support, a remembered tab and lazy panels.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-08) |
| Framework | ViRaSPA 0.1.0 or newer (milestone N8) |
| Isolation | `full` |

## Install

```bash
node node-tools/install.js add component vs-tabs@0.1.0
```

Nothing else to do: it loads the first time `<vs-tabs>` appears.

## Usage

```html
<vs-tabs remember="customer-tabs">
  <section label="General">…</section>
  <section label="Addresses" icon="lucide:map-pin">…</section>
  <section label="History" lazy><template>…created when first shown…</template></section>
  <section label="Audit" disabled>…</section>
</vs-tabs>
```

Any child with a `label` is a panel (`icon`, `disabled`, `hidden`, `lazy` on the panel).

## Attributes and properties

| Name | Meaning |
| --- | --- |
| `selected` | The first tab: an index or a panel `id`. |
| `remember` | A key: the last tab is kept in this browser. |
| `orientation` | `horizontal` (default) or `vertical`. |
| `activation` | `auto` (default: shown as focus moves) or `manual` (Enter/Space shows it). |
| `selectedIndex` | Property: read or set the tab. |

## Keyboard

Left/Right (Up/Down when vertical; mirrored right-to-left), Home/End; disabled tabs are skipped.

## Events

`vs-tab-change` (`detail: { index, panel }`).

## Version history

- **0.1.0 (2026-11-08):** first version (migrated from `FIITTabPane`).