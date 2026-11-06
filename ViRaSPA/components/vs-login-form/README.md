# vs-login-form

A configurable sign-in form. You can set:

- labels and the type of the username field;
- Remember Me and Forgot Password;
- where messages appear;
- buttons for external sign-in providers (Google, Microsoft…).

It doesn't talk to any server itself: it hands the credentials to your code.

| | |
| --- | --- |
| Version | 0.1.0 (2026-11-06) |
| Framework | ViRaSPA 0.2.0 or newer |
| Isolation | `scoped` (no Shadow DOM, so password managers and autofill work reliably; its styles stay inside it) |

## Install

```bash
node node-tools/install.js add component vs-login-form@0.1.0
```

## Usage

```html
<div class="login-panel">
  <vs-login-form remember-me forgot-password-href="/forgot-password" message-position="top">
    <img slot="logo" src="app/assets/icons/favicon.svg" alt="" width="48">
    <p slot="footer" class="text-muted">By signing in you accept the terms.</p>
  </vs-login-form>
</div>
```

```js
const form = document.querySelector("vs-login-form");
form.providers = [{ id: "google", label: "Google", icon: "fontawesome:google:brands" }]; // set before it loads
form.loginHandler = async ({ username, password, rememberMe }) => {
  const res = await fetch("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
  if (!res.ok) throw new Error("Wrong email or password."); // shown in the form
};
form.addEventListener("vs-login-success", () => Viraspa.core.navigate("/dashboard"));
```

## Who handles the sign-in

1. **`element.loginHandler(credentials)`**, if set.
2. **Otherwise `Viraspa.session.login(credentials)`**, when the app has a session (ViRaSPA 0.2.0 M3).
3. **Otherwise nothing:** listen for the `vs-login` event.

`credentials` is `{ username, password, rememberMe }`. If the handler throws, its message is shown as the error. Provider buttons work the same way, through `element.providerHandler(provider)` or `Viraspa.session.loginWith(provider.id)`.

## Attributes

| Attribute | Default | Meaning |
| --- | --- | --- |
| `heading` | `Sign In` | The form's title. |
| `username-label` | `Email` | |
| `username-type` | `email` | `email` or `text` (for user names). |
| `password-label` | `Password` | |
| `submit-label` / `busy-label` | `Sign In` / `Signing In...` | The button text, and its text while signing in. |
| `remember-me` | off | Shows a "Remember Me" checkbox. |
| `remember-me-label` | `Remember Me` | |
| `forgot-password-href` | none | Shows a "Forgot Password?" link to this route or URL. |
| `forgot-password-label` | `Forgot Password?` | |
| `message-position` | `top` | `top`, `bottom` or `toast`. |
| `providers-label` | `Or continue with` | The text above the provider buttons. |
| `required-message` / `failed-message` | (see model) | The default messages. |

## Properties

| Property | Meaning |
| --- | --- |
| `providers` | `[{ id, label, icon }]`. Set it before the element loads. |
| `loginHandler` | `async (credentials) => result`. Throw to show an error. |
| `providerHandler` | `async (provider) => result` |
| `showMessage(text, type)` | Shows a message yourself. `type`: `error`, `success` or `info`. |

## Events

| Event | Detail | Notes |
| --- | --- | --- |
| `vs-login` | `{ credentials }` | Before the handler runs. Call `preventDefault()` to handle it yourself. |
| `vs-login-success` | `{ result }` | The handler finished without an error. |
| `vs-login-provider` | `{ provider }` | A provider button was pressed. It can be cancelled. |

## Slots

`logo` (above the heading) and `footer` (below everything).

## Parts and styling

Parts are `form`, `heading`, `message`, `username`, `password`, `forgot`, `submit`, `providers` and `provider`. In `scoped` mode, style them as `vs-login-form [part="submit"]`. The page's own styles also reach in, e.g. base.css `.btn` and `.form-field`.

CSS variable: `--vs-login-form-width` (default `22rem`).

## Accessibility

- Every field has a `<label>`.
- Messages use `role="alert"`.
- While signing in, the form is `aria-busy` and the button is disabled.
- On an error, focus goes back to the password field.

## Version history

- **0.1.0 (2026-11-06):** first release.
