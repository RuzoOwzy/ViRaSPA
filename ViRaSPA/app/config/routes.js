// Each route maps a URL path to a page folder. The page's files are found
// by naming convention: "app/pages/home" -> home.js, .html, .css and
// .model.json in that folder. Paths are matched case-insensitively and
// without a trailing slash, so write them in lowercase.
//
// Options:
//   title      the browser tab title (head.title overrides it)
//   head       { title, description, image, icon } - see README "Head information"
//   prerender  true: node-tools/prerender.js writes a ready-made copy (public pages only)
//   layout     "public" | "private" | "inherit" (default): which shell around the page
//   access     "private" needs a signed-in user
//   requires   { privileges: [...], match: "all" | "any", roles: [...] }
//   nav        { label, icon, menus, order, divider: "before" } lists the route
//              in a vs-menu (menus defaults to ["main"]), or a list of such entries
//   keepAlive  true keeps the page (its DOM and state) when the user leaves
//   native     true for a plain page: .html, .css and a plain .js
//   i18n       true: the page has its own translations (<name>.i18n.<language>.json),
//              one per language except the default; or a list, e.g. ["en", "sw"]
//
// Backend endpoints don't belong here - see app/config/endpoints.js.
window.Viraspa.routes = [
  // ---- Public website -------------------------------------------------
  {
    path: "/",
    name: "home",
    page: "app/pages/home",
    title: "ViRaSPA — Home",
    head: {
      description: "ViRaSPA is a no-build single-page application framework in plain HTML, CSS and JavaScript.",
      image: "app/assets/icons/apple-touch-icon.png",
    },
    layout: "public",
    keepAlive: true,
    prerender: true,
    nav: [
      { label: "Home", icon: "lucide:house", menus: ["main"], order: 1 },
      { label: "Website", icon: "lucide:globe", menus: ["side"], order: 100 },
    ],
  },
  {
    path: "/showcase",
    name: "showcase",
    page: "app/pages/showcase",
    title: "Showcase · ViRaSPA",
    head: { description: "Every official ViRaSPA component, live." },
    layout: "public",
    nav: { label: "Showcase", icon: "lucide:layout-grid", menus: ["main"], order: 3 },
  },
  {
    path: "/orders",
    name: "orders",
    page: "app/pages/orders",
    title: "Orders · ViRaSPA",
    head: { description: "A list page: search, filters, selection, row actions and export with vs-table." },
    layout: "public",
    nav: { label: "Orders", icon: "lucide:list", menus: ["main"], order: 5 },
  },
  {
    path: "/data-entry",
    name: "data-entry",
    page: "app/pages/data-entry",
    title: "Data Entry · ViRaSPA",
    head: { description: "Keyboard-only data entry with the forms, data-entry, filter and tooltip helpers." },
    layout: "public",
    nav: { label: "Data Entry", icon: "lucide:keyboard", menus: ["main"], order: 4 },
  },
  {
    // A route with a parameter: /people/1, /people/2... (this.params.id).
    path: "/people/:id",
    name: "person",
    page: "app/pages/person",
    title: "Person · ViRaSPA",
    head: {
      title: "{{name}} · ViRaSPA Sample",
      description: "{{name}} works at {{company}}. A sample of a page with a parameter.",
    },
    layout: "public",
  },
  {
    path: "/features",
    name: "features",
    page: "app/pages/features",
    title: "ViRaSPA — Features",
    head: { description: "Everything ViRaSPA can do, with links and live examples." },
    prerender: true,
    nav: [
      { label: "Features", icon: "lucide:sparkles", menus: ["main"], order: 2 },
      { label: "Features", icon: "lucide:sparkles", menus: ["side"], order: 50, divider: "before" },
    ],
  },
  {
    // Signals, template bindings, translations and formats.
    path: "/live-demo",
    name: "live-demo",
    page: "app/pages/live-demo",
    title: "ViRaSPA — Live Demo",
    head: { description: "Signals, live template bindings, translations and formats in action." },
    i18n: true, // has live-demo.i18n.<language>.json files
    prerender: true,
    nav: [
      { label: "Live Demo", icon: "lucide:zap", menus: ["main"], order: 2.5 },
      { label: "Live Demo", icon: "lucide:zap", menus: ["side"], order: 55 },
    ],
  },
  {
    path: "/about",
    name: "about",
    page: "app/pages/about",
    title: "ViRaSPA — About",
    head: { description: "What ViRaSPA is, and how its components isolate their styles." },
    prerender: true,
    nav: [
      { label: "About", icon: "lucide:info", menus: ["main"], order: 3 },
      { label: "About", icon: "lucide:info", menus: ["side"], order: 60 },
    ],
  },
  {
    path: "/contact",
    name: "contact",
    page: "app/pages/contact",
    title: "ViRaSPA — Contact",
    head: { description: "Send us a message." },
    prerender: true,
    nav: [
      { label: "Contact", icon: "lucide:mail", menus: ["main"], order: 4 },
      { label: "Contact", icon: "lucide:mail", menus: ["side"], order: 70 },
    ],
  },
  {
    // Written in plain HTML, CSS and JS only - no Viraspa.* calls.
    path: "/plain-native",
    name: "plain-native",
    page: "app/pages/plain-native",
    title: "ViRaSPA — Plain Native Page",
    native: true,
  },
  {
    path: "/login",
    name: "login",
    page: "app/pages/login",
    title: "ViRaSPA — Sign In",
    layout: "public",
  },

  // ---- Private app ----------------------------------------------------
  {
    path: "/dashboard",
    name: "dashboard",
    page: "app/pages/dashboard",
    title: "ViRaSPA — Dashboard",
    layout: "private",
    access: "private",
    nav: { label: "Dashboard", icon: "lucide:layout-dashboard", menus: ["side"], order: 10 },
  },
  {
    path: "/users",
    name: "users",
    page: "app/pages/users",
    title: "ViRaSPA — Users",
    layout: "private",
    requires: { privileges: ["users.view"] },
    nav: { label: "Users", icon: "lucide:users", menus: ["side"], order: 20 },
  },
  {
    path: "/settings",
    name: "settings",
    page: "app/pages/settings",
    title: "ViRaSPA — Settings",
    layout: "private",
    requires: { privileges: ["settings.view"] },
    nav: { label: "Settings", icon: "lucide:settings", menus: ["side"], order: 30 },
  },
  {
    path: "/profile",
    name: "profile",
    page: "app/pages/profile",
    title: "ViRaSPA — Profile",
    layout: "private",
    access: "private",
  },
  {
    path: "/change-credentials",
    name: "change-credentials",
    page: "app/pages/change-credentials",
    title: "ViRaSPA — Change Credentials",
    layout: "private",
    access: "private",
  },
  {
    // Shown when a signed-in user lacks a privilege (session forbiddenRoute).
    path: "/forbidden",
    name: "forbidden",
    page: "app/pages/forbidden",
    title: "ViRaSPA — No Access",
  },
];

// Shown when no route matches the URL. It has no path, so it's never a
// link target and never listed in a menu.
window.Viraspa.notFoundRoute = {
  name: "not-found",
  page: "app/pages/not-found",
  title: "ViRaSPA — Not Found",
};
