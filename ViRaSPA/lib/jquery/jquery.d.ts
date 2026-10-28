// Hand-written declarations covering jQuery's common API surface, for
// editor autocomplete (VS Code / Visual Studio) with no npm/build step.
// Not the full official @types/jquery package (that's a multi-file npm
// package, impractical to vendor by hand) - extend this file if a method
// you need isn't suggested.

interface JQueryAjaxSettings {
  method?: string;
  data?: unknown;
  headers?: Record<string, string>;
  dataType?: string;
  contentType?: string | false;
  success?: (data: unknown, textStatus: string, jqXHR: JQueryXHR) => void;
  error?: (jqXHR: JQueryXHR, textStatus: string, errorThrown: string) => void;
  [key: string]: unknown;
}

interface JQueryXHR extends Promise<unknown> {
  status: number;
  statusText: string;
  responseText: string;
  responseJSON?: unknown;
}

interface JQuery {
  readonly length: number;
  [index: number]: HTMLElement;

  // Selecting / traversing
  find(selector: string): JQuery;
  parent(selector?: string): JQuery;
  parents(selector?: string): JQuery;
  closest(selector: string): JQuery;
  children(selector?: string): JQuery;
  eq(index: number): JQuery;
  first(): JQuery;
  last(): JQuery;
  is(selector: string): boolean;
  filter(selector: string | ((index: number, element: HTMLElement) => boolean)): JQuery;
  each(callback: (index: number, element: HTMLElement) => void): JQuery;

  // Content / attributes
  html(): string;
  html(value: string): JQuery;
  text(): string;
  text(value: string | number): JQuery;
  val(): string;
  val(value: string | number): JQuery;
  attr(name: string): string | undefined;
  attr(name: string, value: string | number): JQuery;
  removeAttr(name: string): JQuery;
  data(key: string): unknown;
  data(key: string, value: unknown): JQuery;

  // Classes
  addClass(className: string): JQuery;
  removeClass(className: string): JQuery;
  toggleClass(className: string, state?: boolean): JQuery;
  hasClass(className: string): boolean;

  // CSS / layout
  css(property: string): string;
  css(property: string, value: string | number): JQuery;
  css(properties: Record<string, string | number>): JQuery;
  width(): number;
  height(): number;
  outerWidth(includeMargin?: boolean): number;
  outerHeight(includeMargin?: boolean): number;
  show(): JQuery;
  hide(): JQuery;
  toggle(state?: boolean): JQuery;

  // Events
  on(events: string, handler: (event: JQuery.Event) => void): JQuery;
  on(events: string, selector: string, handler: (event: JQuery.Event) => void): JQuery;
  off(events: string, handler?: (event: JQuery.Event) => void): JQuery;
  trigger(eventType: string, extraParameters?: unknown): JQuery;
  click(handler?: (event: JQuery.Event) => void): JQuery;
  focus(handler?: (event: JQuery.Event) => void): JQuery;
  blur(handler?: (event: JQuery.Event) => void): JQuery;

  // DOM manipulation
  append(content: string | JQuery): JQuery;
  prepend(content: string | JQuery): JQuery;
  remove(): JQuery;
  empty(): JQuery;
  clone(): JQuery;

  // Our own extensions - see jquery-extensions.js
  cssX(property: string, value: string | undefined, priority?: string): JQuery;
  cssVar(name: string): string;
}

declare namespace JQuery {
  interface Event {
    type: string;
    target: HTMLElement;
    currentTarget: HTMLElement;
    preventDefault(): void;
    stopPropagation(): void;
  }
}

interface JQueryStatic {
  (selector: string, context?: Element | JQuery): JQuery;
  (element: Element | Window | Document): JQuery;
  (html: string): JQuery;
  (callback: () => void): JQuery;

  ajax(settings: JQueryAjaxSettings): JQueryXHR;
  get(url: string, success?: (data: unknown) => void): JQueryXHR;
  post(url: string, data?: unknown, success?: (data: unknown) => void): JQueryXHR;

  fn: JQuery;
}

declare const $: JQueryStatic;
declare const jQuery: JQueryStatic;
