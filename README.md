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

## App icon

The original WorkAround mark is `public/icons/workaround.svg`: a paused clock in
a dark rounded tile, with a sky-blue time interval matching the focus interface.
The popup, options header, toolbar icons and tab favicon share this mark.

```bash
npm run build:icons
```

This regenerates true-size PNG exports at 16, 32, 48, 96, 128, 256 and 512 pixels
and a multi-resolution favicon from the SVG. Normal builds
run this step automatically. Edit the SVG to change the design; the PNGs and ICO
are derived assets. Build validation checks manifest icon dimensions.
