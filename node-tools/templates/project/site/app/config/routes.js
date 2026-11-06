// Each route maps a URL path to a page folder: "app/pages/home" ->
// home.js, .html, .css and .model.json in that folder.
// Options: title, nav { label, icon, menus, order }, access, keepAlive, native.
window.Viraspa.routes = [
  {
    path: "/",
    name: "home",
    page: "app/pages/home",
    title: "%%PROJECT_NAME%% — Home",
    access: "public",
    nav: { label: "Home" },
  },
];

// Shown when no route matches the URL.
window.Viraspa.notFoundRoute = {
  name: "not-found",
  page: "app/pages/not-found",
  title: "%%PROJECT_NAME%% — Not Found",
};
