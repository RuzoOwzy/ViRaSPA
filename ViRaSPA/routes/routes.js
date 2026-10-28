window.Viraspa = window.Viraspa || {};

// Each route maps a URL path to a page folder. The page's files are found
// by naming convention: "pages/home" -> pages/home/home.js, .html, .css and
// .model.json. Paths are matched case-insensitively and without a trailing
// slash, so write them in lowercase. `nav` (optional) lists the route in the
// nav bar. Backend endpoints don't belong here - see config/endpoints.js.
window.Viraspa.routes = [
  {
    path: "/",
    name: "home",
    page: "pages/home",
    title: "ViRaSPA — Home",
    access: "public",
    nav: { label: "Home" },
  },
  {
    path: "/about",
    name: "about",
    page: "pages/about",
    title: "ViRaSPA — About",
    access: "public",
    nav: { label: "About" },
  },
  {
    path: "/contact",
    name: "contact",
    page: "pages/contact",
    title: "ViRaSPA — Contact",
    access: "public",
    nav: { label: "Contact" },
  },
];

// Shown when no route matches the URL (or the guard denies one). It has no
// path, so it's never a link target and never listed in the nav bar.
window.Viraspa.notFoundRoute = {
  name: "not-found",
  page: "pages/not-found",
  title: "ViRaSPA — Not Found",
};
