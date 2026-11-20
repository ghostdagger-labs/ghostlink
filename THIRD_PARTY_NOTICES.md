# Third-party code and assets

The root MIT license applies to Ghostlink's original code. It does not replace licenses or grant trademark rights for bundled third-party material.

- `packages/ghostlink-server/vendor/kaspa/` contains the official rusty-kaspa v2.0.1 Node WASM artifact, its ISC license and upstream README. `vendor/provenance.json` records the source and checksums. These are included in the server package and checked by the installed consumer tests.
- The core package bundles Figtree, Sora and JetBrains Mono fonts from Fontsource. Their license files are copied to `dist/assets/fonts/` beside the font files.
- Wallet logos and their source records live in `packages/ghostlink-core/src/assets/` and are copied to the core package. Kaspium's bundled upstream license is MIT. The KasWare license reserves brand/logo rights. The Kastle source license is BSL 1.1 and explicitly does not grant logo rights.

**Public release prerequisite:** document permission to redistribute the KasWare and Kastle logos in this SDK, or replace/remove them before publication. The files are currently retained for the existing development UI; adding Ghostlink's MIT license does not resolve their terms. Keep provenance and license notices when changing assets.
