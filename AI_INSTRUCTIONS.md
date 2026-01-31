# AI Instructions

This file contains general instructions and preferences for the AI assistant working on this project.

## Language Preferences

*   **Project Language**: English
    *   All code, comments, documentation (README, JSDoc, etc.), and commit messages must be in English.
    *   The only exception is when the user explicitly requests content in another language for a specific purpose.
*   **User Communication**:
    *   The user may communicate in Polish.
    *   The AI should understand Polish commands but ALWAYS produce output (code, artifacts, docs) in English, unless explicitly told otherwise.

## Project Structure & Conventions

*   **Framework**: Next.js 16 (App Router)
*   **Extension Build**: The project uses `next export` for UI and `esbuild` for background/content scripts. The output folder is `out`.
*   **UI**: Tailwind CSS v4 and Radix UI.

## Coding Standards & Best Practices

To ensure high-quality code and easy navigation for future agents, follow these patterns:

### 1. Design Patterns
*   **Repository Pattern**: strictly used for all data access.
    *   *Do not* call `chrome.storage` directly in UI components or Services.
    *   Use/Extend `ChromeStorageRepository` or create new repositories in `src/data`.
*   **Facade/Service Pattern**: strictly used for business logic.
    *   components should not contain logic like "calculate time remaining".
    *   Delegate to services in `src/services` (e.g., `TimeTrackingService`, `BlockingService`).
*   **Observer Pattern**:
    *   Use `chrome.storage.onChanged` to react to state changes in real-time across contexts (Popup <-> Background <-> Content).

### 2. State Management
*   **Local State**: Use `useState` for transient UI state (e.g., form inputs).
*   **Persistent State**: Use `chrome.storage` (via Repositories) as the single source of truth for app state (limits, usage, settings).
*   **React Query / SWR**: If fetching data from storage in React, create custom hooks in `src/hooks` that wrap the Repository calls.

### 3. Verification & Testing
*   **Self-Correction**: Before finishing a task, always run `node scripts/validate-build.js` (if available) or `npm run build` to ensure no regressions.
*   **Manual Verification**: Since we cannot open a real Chrome browser with extensions, verify logic by:
    *   Checking build output.
    *   Reviewing code for logical flow (especially async/await in Chrome APIs).

### 4. Tech Stack Specifics
*   **Styling**:
    *   Use **Tailwind CSS v4** utility classes.
    *   Avoid custom CSS files unless analyzing `globals.css`.
    *   Use `cn()` utility for class merging.
*   **Components**:
    *   Prefer **Radix UI** primitives for accessible interactive elements.
    *   Keep components small and focused.
