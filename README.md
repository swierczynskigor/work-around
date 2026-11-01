# WorkAround ⏳

WorkAround is a Chrome extension that helps you maintain productivity by tracking the time spent on websites and blocking distractions once set limits are exceeded.

## 🚀 Features

*   **Time Tracking**: Automatically monitors time spent on the active browser tab.
*   **Distraction Blocking**: Once you exceed the daily time limit for a site, you will be blocked by a special overlay ("Time's Up!").
*   **Intuitive Popup**: Quick view of statistics and settings directly from the extension bar.
*   **Options Panel**: Advanced settings and limit management.

## 🛠️ Installation

The project is built using Next.js and requires compilation before loading it into the browser.

### Requirements
*   Node.js (version 18 or newer)
*   npm, yarn, pnpm, or bun

### Installation Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/work-around.git
    cd work-around
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the project:**
    This command generates the static version of the Next.js app and the background/content extension scripts.
    ```bash
    npm run build
    ```

4.  **Load into Chrome:**
    *   Open Chrome and navigate to: `chrome://extensions/`
    *   Enable **Developer mode** in the top right corner.
    *   Click the **Load unpacked** button.
    *   Select the `out` folder created in the project directory after the build.

## 💻 Development

To make changes and develop the project:

1.  Start the development server for the UI (Next.js):
    ```bash
    npm run dev
    ```
    *   The popup/options interface will be available at `http://localhost:3000`.

2.  To test changes in the extension logic (background/content scripts), you must restart `npm run build` and refresh the extension in `chrome://extensions`.

## 🏗️ Tech Stack

*   **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
*   **UI Library**: [React 19](https://react.dev/)
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
*   **Browser API**: Manifest V3 (Storage, Alarms, Scripting, Tabs)
*   **Bundler**: Esbuild (for extension scripts)

## 📄 License

This project is available under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Reliable tracking and focus tools

- Tracking pauses when Chrome loses focus, the screen is locked, the configured
  inactivity threshold is reached, or a manual pause is active. Tracking and
  blocking have independent switches.
- Only consecutive activity samples count. Gaps over 12 seconds, backward clock
  jumps, and service worker restarts never generate catch-up usage. Chrome alarms
  recover state; they do not prove that the user was present. This conservative
  approach can omit a few seconds at uncertain boundaries.
- Inactivity defaults to 3 minutes and can be changed to 1, 5, 10 or 30 minutes.
  Opt-in media tracking allows visible video during inactivity and audible,
  unmuted background playback. Locking the screen always pauses it. Muted
  background video does not count. Duplicate tabs on one domain count once;
  shared budgets count the union of overlapping intervals.
- The popup shows the tracking status, remaining budget, a 15-minute tracking
  pause with automatic resumption, and eligible five-minute access extensions.
  Pausing tracking does not disable blocking.
- Optional warnings appear at 5 minutes and 1 minute remaining. Blocking uses a
  modal in an isolated shadow root. It pauses page media and preserves forms,
  page state and scroll position. Unblocking does not reload the page; media can
  be resumed manually.
- Extensions expire after five wall-clock minutes. Their daily maximum applies
  across all sites. Strict mode disables them, including an existing extension.
  They never bypass focus schedules, allowed-hours rules or Shorts blocking.
- Settings include editable shared daily budgets, allowed URL exceptions,
  weekday/overnight focus schedules, and a 0–60 second entry delay for limited
  sites. An unfinished entry countdown resets when the tab loses focus.
- A URL exception bypasses both blocking and tracking. A path includes its
  subpaths, with a path boundary check. If a query string is supplied, it must
  match exactly, including parameter order. Scheme and port must also match;
  `www.` is normalized.
- Activity history retains the last 30 local calendar days. Removing a session
  requires confirmation and immediately recalculates daily and group budgets.
  Day boundaries follow local time, including daylight-saving changes.

Existing domain limits, schedules, language and theme are retained. Old usage
is imported once as daily totals, with `www.` duplicates merged using the higher
value. Old storage remains untouched as a backup; imported totals cannot recover
precise session times that were never recorded. All new usage mutations run
through the background worker to avoid concurrent writes across tabs.

## Verification

```bash
npm test
npm run lint
npm run build
node scripts/validate-build.js
```

The regression suite covers sleep gaps, clock changes, restart boundaries,
manual pauses, disabled tracking, idle/locked state, media deduplication, local
midnight/DST, overnight schedules, URL exceptions, group overlap, extensions,
entry countdowns, migration, corrections and storage error recovery.

After building, reload the unpacked extension from `out` in
`chrome://extensions` and accept the new `idle` permission if Chrome requests it.
Chrome 120 or newer is required. The background reconnects content scripts on
already-open web pages after extension startup/reload and when a tab is activated.
It probes existing controllers first and only injects a replacement when needed.
If a browser restriction or missing host permission prevents this, the popup
shows a connection warning. Refresh the affected tab and check the extension's
website permissions in the browser's add-on settings.

For a device-level acceptance check, leave a tracked page open, close the laptop
for several minutes, wake it, and verify that the absence did not consume the
budget. Also check screen locking, switching to another app, a long article with
a chosen inactivity threshold, media tracking on/off, and a filled unsaved form
before and after blocking. Native sleep events should be verified on each target
operating system; automated tests simulate the timing and state transitions.

## Firefox and Zen build

```bash
npm run build:firefox
```

This builds the current sources and creates two separate packages:

- `out`: Chrome, with its Manifest V3 service worker.
- `out-firefox`: Firefox 128+ and Zen, with an event-page background script,
  the stable add-on ID `workaround@local`, and native promise-based `browser.*`
  APIs in the background, content script and UI chunks.

If the Chrome output is already up to date, package it without rebuilding Next.js:

```bash
npm run build:extension:firefox
```

Packaging cleans only `out-firefox`; the Chrome output remains intact. Both
build directories are generated and excluded from Git. Validate either package:

```bash
node scripts/validate-build.js
node scripts/validate-build.js --firefox
```

To load in Firefox or Zen:

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `out-firefox/manifest.json`.
4. In `about:addons`, check WorkAround's website permissions if prompted.
5. Refresh existing website tabs to load the new content script.

This is an unsigned development build. Temporary installation lasts until the
browser restarts; load it again afterwards. For updates, rebuild and choose
**Reload** on the debugging page. Open web pages reconnect automatically; if the
popup reports a connection problem, refresh the affected tab and check website
permissions in `about:addons`. A permanent installation requires a separately
signed Firefox package.

## App icon

The original WorkAround mark is `public/icons/workaround.svg`: a paused clock in
a dark rounded tile, with a sky-blue time interval matching the focus interface.
The popup, options header, toolbar icons and tab favicon share this mark.

```bash
npm run build:icons
```

This regenerates true-size PNG exports at 16, 32, 48, 96, 128, 256 and 512 pixels
and a multi-resolution favicon from the SVG. Normal Chrome and Firefox builds
run this step automatically. Edit the SVG to change the design; the PNGs and ICO
are derived assets. Build validation checks manifest icon dimensions.

## Security PIN and focus schedules

In **Settings → Security PIN**, set a 4–8 digit PIN and select protected domains
(one per line, or use the domain shortcuts). Only these domains and their
subdomains require a PIN for extra time. Domains can belong to individual limits
or shared budgets. An empty selection protects no sites. Changing the PIN,
changing the selection, or removing protection requires the current PIN.

Protected sites ask for the PIN both in the popup and on the blocking screen.
Five failed attempts pause PIN verification for one minute, including across
background restarts. Existing extension limits, strict mode, focus schedules and
allowed-hours rules still apply. Credentials are salted and derived with
PBKDF2-HMAC-SHA-256 (600,000 iterations); the plain PIN is never stored. The PIN
and protected-domain selection are local to this device and do not sync.
This is an in-extension friction mechanism: someone who controls the browser can
still disable the extension or clear its data. There is no PIN recovery service;
clearing extension data also removes its configuration.

The **Focus** tab contains schedules only. Choose a workday/evening preset or
**Add schedule**, pick days and hours, review the summary, and save. Presets do
not activate until saved. Overnight schedules show an explicit next-day notice.
Schedules can be named, paused, edited and removed; editing a paused schedule
keeps it paused. Existing unnamed schedules remain available. Focus blocks all
websites except allowed URL exceptions. General tracking/blocking controls live
in **Settings**; shared budgets and allowed URLs live in **Limits**.

The automated tests also cover PIN setup, hashed storage, domain matching,
credential changes/removal, throttling across service restarts, protected and
unprotected extension commands in both browser API variants, and preservation
of paused and overnight schedules.

### Troubleshooting allowed hours

Blocking is enabled by default, including for older settings that only had a
tracking switch. Disabling or pausing time tracking does not implicitly turn off
blocking. An explicit choice to disable blocking is retained.

A site allowed from 18:00 to 23:00 is blocked before 18:00 and from 23:00 onwards,
using the device's local clock. A `facebook.com` rule includes `www.facebook.com`
and other subdomains. Allowed URL exceptions and the separate blocking switch
still apply. Pausing time tracking does not disable allowed-hours blocking.
The popup displays an active block reason and its next available time, and warns
when the page controller could not be restored. After reloading an older build,
refresh a website tab once if it still uses an invalidated content script.
