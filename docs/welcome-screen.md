# Welcome screen and branding

Added 22 October 2026 using the user's supplied lavender welcome reference and
three original PNG brand assets. Assets are copied into `assets/branding`;
the previous icons and all source images are preserved.

## Behavior

- The existing Home route checks the local profile and `welcomeCompleted`.
  Before introduction completion it redirects to `/welcome`, outside the tabs;
  afterward an installation without a profile goes to `/sign-up`.
- Get started saves the boolean through the existing Settings provider and
  parameterized `app_settings` repository, then opens local signup. Replaying
  the welcome after profile creation returns to Home, subject to the PIN gate.
- Learn more and the three page indicators navigate local introduction content.
- Settings → About Maivelle → View welcome screen replays the introduction.
- The new preference defaults to false for existing installations as well as
  new ones. No schema change or migration is needed. Existing app authentication
  and Vault access boundaries are preserved. Direct module links are covered
  until local profile authentication is completed. See [local profile access](local-profile-access.md).

## Presentation

`src/features/welcome` owns the content, Home entry, screen, styles and decorative
SVG ribbons. Original logo artwork is used for the hero; native text, Lucide
icons and real buttons sit above the decorative vector background. This is an
adaptation of the reference rather than a screenshot rendered as an interface.
The slogan-logo appears in About. The welcome canvas is intentionally light
lavender even when the main application's theme is dark.

At the user's latest request, welcome and account screens use fixed View layouts
with no ScrollView. Font scaling remains enabled; welcome spacing and logo height
adapt to the safe viewport. Value cards stay in one row, with their optional
descriptions omitted in compact layouts. Safe areas are applied without
copying the reference image's iOS status bar. There are no new packages, network
requests or phone-test runs.

## Reload and launcher icon

The welcome UI and copied images load through the existing Metro development
session. Reload to see the introduction; later visits are available from About.

`app.json` now names the app Maivelle and points its icon and Android adaptive
foreground to the supplied app-icon PNG with a dark purple background. The old
unrelated adaptive background/monochrome configuration was removed while its
files were retained. The installed Android launcher icon/name will change only
after a future local native prebuild/rebuild and replacement installation. No
native generation, rebuild, installation or phone operation was performed here.

The image supplied for the launcher is an already-rounded illustrated icon,
not a purpose-made full-bleed adaptive layer set. Android launchers can crop it
differently. A dedicated unmasked foreground and monochrome silhouette would
be a future branding refinement; none were invented or substituted here.

Production storage security limitations remain documented in release readiness.
The introduction makes no claim that the development database is encrypted.

## Checks executed

Lint passed with zero warnings. Strict application TypeScript and the separate
tooling TypeScript checks passed. Automated test suites, Android builds, device
navigation and visual/device checks were not run, respecting the paused testing
workflow. Physical appearance and launcher cropping remain unverified.
