# app/utils

Small helpers with no server calls, e.g. text or number tricks used by several pages:

```js
// app/utils/names.js
(function (Viraspa) {
  Viraspa.app.utils.initials = (name, count = 2) => String(name || "").split(/\s+/).map((w) => w[0]).slice(0, count).join("").toUpperCase();
  // Also usable in templates: {{ initials(user.name) }} or {{ user.name | initials }}
  Viraspa.templates.add("initials", Viraspa.app.utils.initials);
})(window.Viraspa);
```

List each file in `app/config/startup.js` (a "utils" group before the pages need them).