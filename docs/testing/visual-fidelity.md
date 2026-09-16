# Visual fidelity

The original `docs/design/Ghostlink UI/Ghostlink Prototype.html` and its runtime are preserved. The original specification is archived separately; protocol corrections do not change the prototype.

The UI extracts the prototype's dark/light surfaces, text colors, borders, Figtree/Space Grotesk/JetBrains Mono typography, 440px desktop modal, 380px narrow layout, 20/26px radii, 18px body inset, wallet rows, search, tabs, review cards, message panel, status chips, buttons, success/error treatments and entry animation into shared scoped CSS. React and Vue render the same classes and presentation data.

Allowed differences are explicit:

- Only source-backed, configured wallets appear. Logos come from wallet repositories and carry provenance/licenses; fabricated wallet names, counts and prototype monograms are not data sources.
- Source application/domain/network/account/capabilities and verified session data replace mock fields. Prototype relay status, simulated success/failure controls, device switches and navigation are removed.
- Kaspium adds address entry, manual message transfer, signature entry/scanning and expiry regeneration using the prototype's existing account/input/QR/message treatments. QR images contain real bytes, a quiet zone and no center logo obscuring data. No invented pairing URI is shown.
- Backend verification controls success. Application session status is distinguished from connectivity. Actual request text can grow and scroll instead of being clipped.
- New availability/manual badges use the existing secondary text color in light mode: the original muted color produces 4.45:1 contrast on a badge, below the 4.5:1 requirement. The palette itself is unchanged.
- Interface icons use Lucide. The supplied connect-button references control button dimensions/colors and authenticated address layout; wallet-specific marks reflect the actual chosen wallet.

Browser checks cover default/custom palettes, narrow/wide viewports, keyboard behavior, axe accessibility, and React/Vue modal consistency. Visual baselines are generated only after reviewing the rendered UI alongside the preserved prototype. Dynamic messages, expiry values and QR contents must be excluded from pixel-baseline assertions or fixed in a test-only harness; the production UI never fabricates these values.

To inspect the original through the dev server, open `/@fs/<absolute repository path>/docs/design/Ghostlink%20UI/Ghostlink%20Prototype.html`. The original runtime loads its own historical React/Babel/font services; this external loading is confined to the preserved prototype. Ghostlink itself ships its fonts locally.
