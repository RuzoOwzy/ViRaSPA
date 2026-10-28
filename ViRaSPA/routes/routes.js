window.Viraspa = window.Viraspa || {};
window.Viraspa.routes = [
  {
    path: "/",
    name: "home",
    title: "ViRaSPA — Home",
    script: "pages/home/home.js",
    access: "public",
    api: { method: "GET", service: "HttpService", endpoint: "https://jsonplaceholder.typicode.com/users?_limit=5" },
  },
  {
    path: "/about",
    name: "about",
    title: "ViRaSPA — About",
    script: "pages/about/about.js",
    access: "public",
  },
  {
    path: "/contact",
    name: "contact",
    title: "ViRaSPA — Contact",
    script: "pages/contact/contact.js",
    access: "public",
    api: { method: "POST", service: "HttpService", endpoint: "https://jsonplaceholder.typicode.com/posts" },
  },
];
