(function (Viraspa) {
  function getPath(data, path) {
    return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), data);
  }

  Viraspa.services = Viraspa.services || {};
  Viraspa.services.databinding = {
    bindTemplate(template, data) {
      return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
        const value = getPath(data, key);
        return value === undefined || value === null ? "" : String(value);
      });
    },
  };
})(window.Viraspa);
