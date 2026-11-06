(function (Viraspa) {
  // The persistent app shell is plain markup in index.html (e.g. <vs-header>,
  // <main id="page-root">, <vs-footer>). It is built once; only #page-root's
  // content changes per route. loadLayout() loads the components the shell
  // uses and waits for them to finish, so the shell and the first page
  // appear together.

  Viraspa.core = Viraspa.core || {};

  // Every framework component inside `root`, including inside shadow roots.
  function frameworkComponents(root, found = []) {
    for (const el of root.querySelectorAll("*")) {
      if (el instanceof Viraspa.core.Component) found.push(el);
      if (el.shadowRoot) frameworkComponents(el.shadowRoot, found);
    }
    return found;
  }

  Viraspa.core.loadLayout = async function () {
    const { emit } = Viraspa.core;
    emit("layoutBeforeLoad");
    const pageRoot = document.getElementById("page-root");
    if (!pageRoot) {
      console.error('index.html needs an element with id="page-root", where pages are shown.');
    }
    await Viraspa.core.components.scan(document.body);
    Viraspa.core.components.watch();
    Viraspa.session.applyPrivileges(document.body);
    emit("layoutOnLoad");

    // Wait for the shell's components, and for components they render in
    // turn (a header's menu, a menu's icons...), a few levels deep.
    const waited = new Set();
    for (let depth = 0; depth < 5; depth++) {
      const pending = frameworkComponents(document.body).filter(
        (el) => !waited.has(el) && !(pageRoot && pageRoot.contains(el))
      );
      if (!pending.length) break;
      pending.forEach((el) => waited.add(el));
      await Promise.all(pending.map((el) => el.ready));
    }
    emit("layoutAfterLoad");
  };
})(window.Viraspa);
