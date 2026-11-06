// Declarations for this project's own jquery-extensions.js.
// jquery.d.ts already includes cssX/cssVar on the JQuery interface above -
// this file is the place to extend that interface as more extensions are
// added to jquery-extensions.js.

interface JQuery {
  cssX(property: string, value: string | undefined, priority?: string): JQuery;
  cssVar(name: string): string;
}
