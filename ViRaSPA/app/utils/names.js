(function (Viraspa) {
  // App utilities: small helpers with no server calls (README "Your own
  // code"). Also registered as a template helper, so templates can write
  // {{ initials(user.name) }} or {{ user.name | initials }}.
  Viraspa.app.utils.initials = (name, count = 2) =>
    String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .slice(0, count)
      .join("")
      .toUpperCase();

  Viraspa.templates.add("initials", Viraspa.app.utils.initials);
})(window.Viraspa);