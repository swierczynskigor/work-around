# Architecture Overview

This document provides a high-level map of the `work-around` project to help AI agents and developers navigate the codebase efficiently.

## System Components

The project is a **Chrome Extension** built with **Next.js**. It consists of three main isolated contexts that communicate via standard Chrome APIs.

```mermaid
graph TD
    subgraph "Extension Context"
        BG[Background Script<br/>(Service Worker)]
        CS[Content Script<br/>(Page Overlay)]
    end

    subgraph "UI Context (Next.js)"
        Popup[Popup UI]
        Options[Options UI]
    end

    subgraph "Data Layer"
        Store[Chrome Storage<br/>(Sync/Local)]
    end

    Popup -->|Reads/Writes| Store
    Options -->|Reads/Writes| Store
    BG -->|Listens| Store
    BG -->|Tracks Time| Store
    CS -->|Reads Limits| Store
    CS -->|Blocks Page| DOM[DOM]
```

## Directory Structure & Responsibilities

| Path | Context | Responsibility |
| :--- | :--- | :--- |
| `src/app` | **UI** | Next.js App Router. Contains pages for `popup` and `options`. Built to `out/`. |
| `src/background` | **Worker** | Service Worker (`index.ts`). Handles time tracking, alarms, and browser events. |
| `src/content` | **Page** | Content Script (`index.ts`). Injected into pages. Checks limits and renders blocking overlay. |
| `src/data` | **Shared** | **Repository Pattern**. Direct access to `chrome.storage`. |
| `src/services` | **Shared** | **Facade/Service Pattern**. Business logic (e.g., `TimeTrackingService`) that uses Repositories. |
| `src/domain` | **Shared** | TypeScript Interfaces and Types defining the data model. |
| `src/components` | **UI** | Reusable UI components (Radix UI + Tailwind). |
| `scripts` | **Build** | Custom build scripts (`build-extension.js`) to bundle non-Next.js parts. |

## Data Flow

1.  **Configuration**: User sets limits in **Options UI**. Data is saved via `ChromeStorageRepository`.
2.  **Tracking**: **Background Script** listens to `tabs.onActivated` and tracks duration. Updates usage stats in Storage.
3.  **Enforcement**: **Content Script** polls Storage (or listens for changes) to check if the current domain exceeds the limit. If yes, it injects a blocking overlay.

## Key Design Patterns

*   **Repository Pattern**: All raw data access (loading/saving settings) is encapsulated in `src/data/*Repository.ts`.
*   **Service Pattern**: Logic for "is this site blocked?" or "track time" is in `src/services/`.
*   **Observer Pattern**: The extension relies heavily on `chrome.storage.onChanged` and `chrome.tabs.onUpdated`.

## Build Pipeline

1.  **Next.js Build**: `next build` -> Export static HTML/CSS/JS to `out/`.
2.  **Extension Build**: `node scripts/build-extension.js` -> Bundles `src/background` and `src/content` using esbuild to `out/`.
3.  **Post-Processing**: Renames `_next` to `next` to comply with Chrome Web Store rules.
