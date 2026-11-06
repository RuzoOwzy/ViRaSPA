# %%PROJECT_NAME%%

A [ViRaSPA](https://github.com/RuzoOwzy/ViRaSPA) app: plain HTML, CSS and JavaScript, no build step.

## Run it

```bash
node node-tools/serve.js
```

Then open http://localhost:8027/.

## Layout

| Path | Contents | In git? |
| --- | --- | --- |
| `%%SITE%%/index.html` | settings and app shell | yes |
| `%%SITE%%/app/` | your code: pages, components, config, `project-viraspa.json` | yes |
| `%%SITE%%/viraspa/`, `components/`, `extensions/`, `lib/` | installed by `node-tools/install.js` | no |
| `node-tools/` | serve, install and other tools (`node node-tools/help.js`) | yes |

## On a new computer

```bash
node node-tools/install.js restore
```

This installs exactly the framework, components and libraries pinned in `%%SITE%%/app/project-viraspa.json`, and checks their checksums.
