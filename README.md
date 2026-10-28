# ViRaSPA

A vanilla HTML, CSS and JavaScript single-page application (SPA) framework — no build step, no TypeScript transpilation, just plain files served as-is.

## Goals

- **Page and component folders**: each page/component keeps its `.html`, `.css`, `.js` and `.model.json` together in one kebab-case folder.
- **Core framework JS**: one core wires everything into the single `index.html`, with lifecycle events (Before/On/After) for load, data binding, validation and requests at page and component level.
- **Services**: data-binding services and communication services (Fetch/Ajax/WebSocket), with route-driven HTTP methods.
- **Path-based routing** via the History API, with an SPA fallback dev server (`node-server.js`), a visual 404 page and a pluggable public/private route guard.
- **On-demand loading**: pages and components are fetched from the server only when needed, then cached.
- **Opt-in libraries**: external CSS/JS (jQuery, Tailwind, Bootstrap, etc.) is added explicitly in `index.html`, never loaded by default.

## Documentation

The current framework model (a working draft) is in
[Documents/Modeling my Own Custom SPA Web Development Frontend Framework.txt](Documents/Modeling%20my%20Own%20Custom%20SPA%20Web%20Development%20Frontend%20Framework.txt).
