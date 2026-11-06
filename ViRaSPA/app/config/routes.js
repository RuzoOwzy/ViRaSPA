// Each route maps a URL path to a page folder. The page's files are found
// by naming convention: "app/pages/home" -> home.js, .html, .css and
// .model.json in that folder. Paths are matched case-insensitively and
// without a trailing slash, so write them in lowercase.
//
// Options:
//   title      the browser tab title
//   nav        { label, icon, menus, order } lists the route in a vs-menu:
//              menus defaults to ["main"]; icon e.g. "lucide:house"
//   access     "public" | "private" (read by Viraspa.core.guard)
//   keepAlive  true keeps the page (its DOM and state) when the user leaves,
//              so coming back is instant; see settings.pageCache.maxPages
//   native     true for a plain page: .html, .css and a plain .js, with no
//              page class, model or {{ }} placeholders
//
// Backend endpoints don't belong here - see app/config/endpoints.js.
window.Viraspa.routes = [
  {
    path: "/",
    name: "home",
    page: "app/pages/home",
    title: "ViRaSPA — Home",
    access: "public",
    keepAlive: true,
    nav: { label: "Home", icon: "lucide:house" },
  },
  {
    path: "/about",
    name: "about",
    page: "app/pages/about",
    title: "ViRaSPA — About",
    access: "public",
    nav: { label: "About", icon: "lucide:info" },
  },
  {
    path: "/contact",
    name: "contact",
    page: "app/pages/contact",
    title: "ViRaSPA — Contact",
    access: "public",
    nav: { label: "Contact", icon: "lucide:mail" },
  },
  {
    // Written in plain HTML, CSS and JS only - no Viraspa.* calls.
    path: "/plain-native",
    name: "plain-native",
    page: "app/pages/plain-native",
    title: "ViRaSPA — Plain Native Page",
    access: "public",
    native: true,
  },
];

// Shown when no route matches the URL (or the guard denies one). It has no
// path, so it's never a link target and never listed in the nav bar.
window.Viraspa.notFoundRoute = {
  name: "not-found",
  page: "app/pages/not-found",
  title: "ViRaSPA — Not Found",
};
