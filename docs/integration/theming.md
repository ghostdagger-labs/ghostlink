# Branding and native components

The native Vue and React renderers use the same controller, presentation functions and scoped CSS. Import `ghostlink-core/styles.css` once. For exact default typography also import `ghostlink-core/fonts.css`; all fonts are local WOFF2 files, with no runtime font-service requests.

Use `theme="dark"` (default) or `theme="light"` on both `GhostlinkConnectButton` and `GhostlinkModal`. Pass a `variables` map to both because the modal is teleported/portaled to `document.body`.

```ts
const variables = {
  '--ghostlink-button': '#b9e5d7',
  '--ghostlink-button-text': '#132921',
  '--ghostlink-accent': '#7fc8a9',
  '--ghostlink-accent-soft': 'rgba(127,200,169,.12)',
  '--ghostlink-accent-line': 'rgba(127,200,169,.38)',
  '--ghostlink-connect-background': '#b9e5d7',
  '--ghostlink-connect-text': '#132921',
  '--ghostlink-font-body': 'Your Sans, system-ui, sans-serif',
  '--ghostlink-font-heading': 'Your Sans, system-ui, sans-serif',
  '--ghostlink-font-mono': 'Your Mono, monospace',
};
```

All palette tokens are listed at the top of `packages/ghostlink-core/src/styles.css`: background/surfaces, borders, primary/secondary/muted text, accent, warning/danger/success, chip, button, connect-button and authenticated-button palettes. Set foreground and background together and check accessibility for customized colors. The example uses a darker green accent in light mode to preserve contrast.

Defaults follow the [Ghostlink brand document](../design/brand/Ghostlink%20Brand.dc.html): violet accents, neutral surfaces, and green/red state colors. `--ghostlink-button` defaults to the main text color: primary buttons and selected tabs retain a neutral light fill with dark text in dark mode, and a dark fill with white text in light mode. They share the button foreground/background pair; violet remains an accent for links. Focus indicators use the neutral `--ghostlink-focus-ring` token (muted text by default). The search field has one outer focus ring, with no duplicate input outline. The soft and line interaction tokens retain neutral overlays and their original opacity, keeping wallet-row hover and waiting indicators subtle; they remain independently overridable. Signed-out connect buttons default to that same pair, with `--ghostlink-connect-background` and `--ghostlink-connect-text` available for independent overrides. Authenticated buttons use `--ghostlink-account-background`, `--ghostlink-account-text`, and `--ghostlink-account-border` in both themes; their defaults reference the current surface, secondary text and border tokens. All explicit `variables` overrides take precedence over theme defaults.

The two-node Ghostlink mark inherits `currentColor`; wallet logos and host-app icons retain their own branding. Default fonts are Figtree for UI/body, Sora Semibold for headings, and JetBrains Mono for technical text. Import your own fonts locally and omit `fonts.css` if you do not want bundled defaults. The brand document's `--gl-*` examples do not replace the library's public `--ghostlink-*` tokens.

The CSS applies only within `.gl-theme`; it does not reset the application body, headings or forms. Default modal width is 440px, or up to 380px on narrow viewports, with viewport-bounded scrolling. Native dialogs provide inert backgrounds and focus restoration, with shared explicit keyboard wrapping, labelled buttons, reduced-motion support and announcements for progress/errors.

Vue exposes the connect button's default slot (`snapshot`, `open`) and modal `content` slot (`snapshot`, `client`). React exposes equivalent render-function children. A custom trigger can call `client.connect()` or `client.open()`. Keep one modal host per controller. Use the slot/render-function escape hatches only when taking responsibility for equivalent accessibility and review behavior. For an entirely headless app, render directly from `getSnapshot()` / `subscribe()` and retain wallet approval for every operation.

The Vue example's “Try custom branding” control demonstrates palette and heading-font overrides using the public API.
