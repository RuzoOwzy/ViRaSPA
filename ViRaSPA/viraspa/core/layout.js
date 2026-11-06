(function (Viraspa) {
  // The persistent app shell is plain markup in index.html (e.g. a header
  // component, <main id="page-root">, a footer component). It is built once;
  // only #page-root's content changes per route. loadLayout() waits for the
  // shell's framework components to finish loading before the first page,
  // so the shell and the first page appear together.

  Viraspa.core = Viraspa.core || {};

  Viraspa.core.loadLayout = async function () {
    const { emit, Component } = Viraspa.core;
    emit("layoutBeforeLoad");
    const pageRoot = document.getElementById("page-root");
    if (!pageRoot) {
      console.error('index.html needs an element with id="page-root", where pages are shown.');
    }
    const shellComponents = Array.from(document.body.querySelectorAll("*")).filter(
      (el) => el instanceof Component && !(pageRoot && pageRoot.contains(el))
    );
    emit("layoutOnLoad");
    await Promise.all(shellComponents.map((el) => el.ready));
    emit("layoutAfterLoad");
  };
})(window.Viraspa);
