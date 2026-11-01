# Architecture Overview

WorkAround is a Manifest V3 Chrome extension. Next.js statically exports the popup
and options pages; esbuild bundles the background worker and content script.

```mermaid
graph TD
    Popup[Popup / Options] -->|Settings via repository| Settings[Chrome Storage Sync]
    Popup -->|Commands| Background[Background worker]
    Content[Content script] -->|Activity samples / policy requests| Background
    Background -->|Single writer via repository| Usage[Chrome Storage Local: usage v2]
    Background -->|Pause persistence| Session[Chrome Storage Session]
    Settings -->|Change observer| Background
    Usage -->|Change observer| Popup
    Background -->|Policy decision| Content
    Content --> Modal[Shadow-root modal / warnings]
```

## Responsibilities

- `src/services/ActivityTracker.ts`: observed time intervals, duplicate-domain
  elimination, gap protection and local-midnight splitting. It does not access
  browser APIs or storage.
- `src/services/policies.ts`: pure policy evaluation, settings defaults and legacy
  normalization, URL exceptions, overlapping group budgets, allowed hours,
  overnight focus schedules, and access extensions.
- `src/data/ChromeStorageRepository.ts`: versioned usage persistence, one-time
  migration, 30-day retention, serialized mutations, settings and preferences.
- `src/background/index.ts`: the only writer of usage data. Serializes browser
  events and commands; observes the active window, active tab and system idle
  state; combines media reports with the browser's audible state. Sampling is
  throttled to four seconds, with exact observed tab/focus transitions committed
  separately. A gap over 12 seconds is discarded. Worker restarts start a fresh
  observation instead of reconstructing elapsed wall time. Policy/status requests
  isolate activity API and usage-write failures so they cannot disable daily
  limits or schedules. Failed entry-gate activity checks keep the gate paused.
- `src/services/ContentScriptService.ts`: probes the main-frame content controller
  and repairs a missing connection with `scripting.executeScript`. Runs after
  background startup/install, on tab activation/completed navigation, and when
  the popup requests the current session. Unsupported/discarded pages are skipped;
  restricted pages return a visible disconnected status instead of a false success.
- `src/content/index.ts`: reports playback, requests policy decisions and renders
  warnings or a native modal dialog in a shadow root. The page DOM is preserved.
  Visible pages check every second; hidden pages report every five seconds,
  subject to browser timer throttling. Entry countdowns require foreground use.
  A private disposal callback removes old timers/listeners/dialogs on reinjection;
  pending responses from disposed controllers cannot recreate stale blocks.
  Main-frame ping responses let the background avoid duplicate controllers.
- `src/hooks`: settings, preferences and activity subscriptions for React.
- `src/components/ProductivitySettings.tsx`: groups, URL exceptions,
  tracking controls and confirmed session corrections.
- `src/components/FocusPanel.tsx`: schedule list, preset previews and day/time
  editor. `src/services/focus.ts` validates schedule creation and edits.
- `src/services/PinService.ts`: local PIN configuration, PBKDF2 verification,
  protected-domain matching and persistent attempt throttling. Management and
  extension-grant commands run through the background queue.
- `src/hooks/usePinSettings.ts`: public PIN status subscriptions and management
  commands. UI contexts receive configuration metadata, never credentials.

## Data and compatibility

`workaround_settings` remains in sync storage. Optional new fields are normalized
at the repository boundary, so existing installations keep their limits and
schedules. Blocking defaults to enabled for fresh settings and legacy settings
without an explicit blocking preference, independently of the tracking switch.
An explicitly saved blocking preference is preserved.

`workaround_usage_v2` in local storage holds observed session intervals and daily
extension grants. Consecutive intervals of one domain/source/day are coalesced.
Per-domain totals and group totals are derived from these records, so deleting a
session corrects every relevant budget without maintaining divergent counters.
Group totals use interval unions. Imported legacy daily totals have no known
interval and are additive. The legacy `workaround_stats` key is retained as a
migration backup and is no longer written.

`workaround_activity_v2` in session storage holds the temporary manual pause.
Unconfirmed timestamps from older workers are never restored as billable time.

`workaround_pin_v1` in local storage holds a random 16-byte salt, PBKDF2-SHA-256
hash (600,000 iterations), protected domains and failed-attempt/lock state. The
credential and selection stay on the same device. A five-attempt lock lasts one
minute. PIN changes, domain changes and removal require verification. Only
extension UI senders can manage protection; website content scripts can request
policy decisions and attempt time extensions for their own tab. The background
derives the hostname from the browser tab and verifies any required PIN before
persisting a grant. Public status contains no salt or hash. A PIN does not bypass
other policy decisions, and does not prevent the browser owner from disabling
the extension or editing extension data.

## Build and verification

`npm test` bundles and runs deterministic policy, repository, tracker and mocked
background integration tests using Node's test runner. `npm run build` generates
`out`, patches static resource paths and extracts inline scripts for extension
CSP. `node scripts/validate-build.js` checks the final package.

## Firefox / Zen packaging

`npm run build:firefox` builds the application and then runs
`scripts/build-firefox.js`. It copies the processed Chrome export into
`out-firefox`, replaces the background service worker declaration with an event
page, and supplies a stable Gecko extension ID for sync storage. Esbuild rewrites
free `chrome` identifiers to `browser` in every JavaScript asset, including UI
chunks and extracted hydration scripts. Strings and property names are preserved.
This selects Firefox's native promise APIs without modifying the Chrome package
or adding a runtime polyfill. Browser-specific background integration tests run
with the same API transformation and a `moz-extension://` origin.
